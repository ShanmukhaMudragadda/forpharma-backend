import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

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
 * POST /api/orders
 * Create a new order
 */
export const createOrder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const orderData = req.body;
        console.log('📝 Creating new order for employee:', req.user?.employeeId);
        console.log('📝 Received order data:', JSON.stringify(orderData, null, 2));

        if (!req.tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
        }

        // Validate required fields
        if (!orderData.chemistId || !orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: chemistId and items are required'
            });
        }

        // Validate chemist exists and is in user's territory
        const chemist = await req.tenantDb.chemist.findFirst({
            where: {
                id: orderData.chemistId,
                isActive: true
            },
            include: {
                territory: true
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

        // Create drug map for price lookup:any
        const drugMap = drugs.reduce((map: any, drug: any) => {
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

        // Generate order ID
        const orderCount = await req.tenantDb.order.count();
        const orderNumber = `ORD-${new Date().getFullYear()}-${uuidv4().split('-')[0].toUpperCase()}`;

        // Determine order status
        const status = orderData.action === 'confirm' ? 'CONFIRMED' : 'DRAFT';
        const orderDate = status === 'CONFIRMED' ? new Date() : (orderData.orderDate ? new Date(orderData.orderDate) : new Date());

        // Enhanced delivery date parsing
        let deliveryDate = null;
        if (orderData.expectedDeliveryDate) {
            console.log('🗓️ Parsing delivery date:', orderData.expectedDeliveryDate);
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
            console.log('✅ Parsed delivery date:', deliveryDate);
        }

        // Create order with transaction
        const result = await req.tenantDb.$transaction(async (tx: any) => {
            // Create order
            const order = await tx.order.create({
                data: {
                    id: orderNumber,
                    organizationId: req.user?.organizationId,
                    chemistId: orderData.chemistId,
                    totalAmount: calculatedTotal,
                    status: status,
                    orderDate: orderDate,
                    deliveryDate: deliveryDate,
                    specialInstructions: orderData.specialInstructions || null,
                    createdById: req.user?.employeeId
                }
            });

            // Create order items
            for (const item of validatedItems) {
                await tx.orderItem.create({
                    data: {
                        orderId: order.id,
                        drugId: item.drugId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        subtotal: item.subtotal
                    }
                });
            }

            return order;
        });

        // Fetch created order with relations for response
        const createdOrder = await req.tenantDb.order.findUnique({
            where: { id: result.id },
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

        console.log('✅ Order created successfully:', result.id);

        res.status(201).json({
            success: true,
            message: `Order ${status === 'CONFIRMED' ? 'confirmed' : 'saved as draft'} successfully`,
            data: {
                orderId: createdOrder.id,
                status: createdOrder.status,
                totalAmount: parseFloat(createdOrder.totalAmount.toString()),
                itemCount: createdOrder.items.length,
                customerName: createdOrder.chemist?.name,
                createdBy: `${createdOrder.createdBy?.firstName || ''} ${createdOrder.createdBy?.lastName || ''}`.trim()
            }
        });

    } catch (error: any) {
        console.error('❌ Error creating order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};