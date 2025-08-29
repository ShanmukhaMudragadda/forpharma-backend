import { Request, Response } from 'express';

// Extended Request interface to include tenant database and user info
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        employeeId: string;
        organizationId: string;
        email: string;
        role: string;
    };
    tenantDb?: any; // Prisma tenant client
}

/**
 * Parse date string (supports multiple formats and handles spaces)
 */
const parseDate = (dateString: string): Date | null => {
    if (!dateString || typeof dateString !== 'string') {
        console.log('❌ Invalid date string:', dateString);
        return null;
    }

    // Remove any extra whitespace and normalize spaces around separators
    let cleanDateString = dateString.trim();
    cleanDateString = cleanDateString.replace(/\s*-\s*/g, '-'); // Replace " - " with "-"
    cleanDateString = cleanDateString.replace(/\s*\/\s*/g, '/'); // Replace " / " with "/"

    console.log('📅 Parsing date string:', dateString, '→ cleaned:', cleanDateString);

    try {
        // Handle standard date formats
        const date = new Date(cleanDateString);
        if (!isNaN(date.getTime())) {
            console.log('✅ Successfully parsed date:', date);
            return date;
        }

        // Handle DD-MM-YYYY format
        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleanDateString)) {
            console.log('📅 Detected DD-MM-YYYY format');
            const parts = cleanDateString.split('-');
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            const parsedDate = new Date(year, month - 1, day);
            if (parsedDate.getFullYear() === year &&
                parsedDate.getMonth() === month - 1 &&
                parsedDate.getDate() === day) {
                console.log('✅ Successfully parsed DD-MM-YYYY:', parsedDate);
                return parsedDate;
            }
        }

        // Handle DD/MM/YYYY format
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanDateString)) {
            console.log('📅 Detected DD/MM/YYYY format');
            const parts = cleanDateString.split('/');
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            const parsedDate = new Date(year, month - 1, day);
            if (parsedDate.getFullYear() === year &&
                parsedDate.getMonth() === month - 1 &&
                parsedDate.getDate() === day) {
                console.log('✅ Successfully parsed DD/MM/YYYY:', parsedDate);
                return parsedDate;
            }
        }

        console.log('❌ No valid date format found for:', cleanDateString);
        return null;

    } catch (error) {
        console.error('❌ Error parsing date:', error);
        return null;
    }
};

/**
 * PUT /api/orders/:orderId
 * Update order details - Enhanced to handle full order replacement
 */
export const updateOrder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { orderId } = req.params;
        const orderData = req.body;
        console.log('🔄 Updating order:', orderId);
        console.log('🔄 Received update data:', JSON.stringify(orderData, null, 2));

        if (!req.tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
        }

        // Check if order exists and belongs to the user
        const existingOrder = await req.tenantDb.order.findFirst({
            where: {
                id: orderId,
                createdById: req.user?.employeeId
            }
        });

        if (!existingOrder) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or you do not have permission to update this order'
            });
        }

        // Only allow updating DRAFT orders for full updates
        if (existingOrder.status !== 'DRAFT' && existingOrder.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: 'Only draft orders can be edited',
                debug: {
                    currentStatus: existingOrder.status,
                    allowedStatuses: ['DRAFT', 'PENDING']
                }
            });
        }

        // Validate required fields for full order update
        if (!orderData.chemistId || !orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: chemistId and items are required for order update'
            });
        }

        // Validate chemist exists
        const chemist = await req.tenantDb.chemist.findFirst({
            where: {
                id: orderData.chemistId,
                isActive: true
            }
        });

        if (!chemist) {
            return res.status(404).json({
                success: false,
                message: 'Chemist not found or inactive'
            });
        }

        // Validate all drugs exist and calculate totals
        const drugIds = orderData.items.map((item: any) => item.drugId);
        const drugs = await req.tenantDb.drug.findMany({
            where: {
                id: { in: drugIds },
                isActive: true
            }
        });

        if (drugs.length !== drugIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more drugs not found or inactive'
            });
        }

        // Create drug map for price lookup
        const drugMap = drugs.reduce((map, drug) => {
            map[drug.id] = drug;
            return map;
        }, {} as any);

        // Validate and calculate order items
        let calculatedTotal = 0;
        const validatedItems = orderData.items.map((item: any) => {
            const drug = drugMap[item.drugId];
            const quantity = parseInt(item.quantity);
            const unitPrice = item.unitPrice ? parseFloat(item.unitPrice) : (drug.price ? parseFloat(drug.price.toString()) : 0);
            const subtotal = quantity * unitPrice;

            calculatedTotal += subtotal;

            return {
                drugId: item.drugId,
                quantity: quantity,
                unitPrice: unitPrice,
                subtotal: subtotal
            };
        });

        // Determine order status
        const status = orderData.action === 'confirm' ? 'CONFIRMED' : 'DRAFT';

        // Enhanced delivery date parsing
        let deliveryDate = null;
        if (orderData.expectedDeliveryDate) {
            console.log('🗓️ Parsing delivery date for update:', orderData.expectedDeliveryDate);
            deliveryDate = parseDate(orderData.expectedDeliveryDate);

            if (!deliveryDate) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid delivery date format: "${orderData.expectedDeliveryDate}". Please use a valid date format.`,
                    debug: {
                        received: orderData.expectedDeliveryDate,
                        type: typeof orderData.expectedDeliveryDate
                    }
                });
            }
            console.log('✅ Parsed delivery date for update:', deliveryDate);
        }

        // Update order with transaction - THIS IS THE KEY PART
        const result = await req.tenantDb.$transaction(async (tx: any) => {
            // 1. Update order table (SAME orderId)
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: {
                    chemistId: orderData.chemistId,
                    totalAmount: calculatedTotal,
                    status: status,
                    deliveryDate: deliveryDate,
                    specialInstructions: orderData.specialInstructions || null,
                    updatedAt: new Date()
                }
            });

            // 2. Delete ALL existing order items
            console.log('🔥 Deleting existing order items for order:', orderId);
            const deletedItems = await tx.orderItem.deleteMany({
                where: { orderId: orderId }
            });
            console.log(`✅ Deleted ${deletedItems.count} existing order items`);

            // 3. Create NEW order items
            console.log(`📦 Creating ${validatedItems.length} new order items`);
            for (const item of validatedItems) {
                await tx.orderItem.create({
                    data: {
                        orderId: orderId, // Same order ID
                        drugId: item.drugId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        subtotal: item.subtotal
                    }
                });
            }

            return updatedOrder;
        });

        // Fetch updated order with relations for response
        const updatedOrder = await req.tenantDb.order.findUnique({
            where: { id: orderId },
            include: {
                chemist: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                createdBy: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                },
                items: {
                    include: {
                        drug: {
                            select: {
                                name: true,
                                manufacturer: true
                            }
                        }
                    }
                }
            }
        });

        console.log('✅ Order updated successfully:', orderId);

        res.status(200).json({
            success: true,
            message: `Order ${status === 'CONFIRMED' ? 'updated and confirmed' : 'updated as draft'} successfully`,
            data: {
                orderId: updatedOrder.id,
                status: updatedOrder.status,
                totalAmount: parseFloat(updatedOrder.totalAmount.toString()),
                itemCount: updatedOrder.items.length,
                customerName: updatedOrder.chemist?.name,
                updatedBy: `${updatedOrder.createdBy?.firstName || ''} ${updatedOrder.createdBy?.lastName || ''}`.trim()
            }
        });

    } catch (error: any) {
        console.error('❌ Error updating order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};