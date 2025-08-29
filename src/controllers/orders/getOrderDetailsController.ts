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
 * GET /api/orders/:orderId
 * Get detailed information about a specific order
 */
export const getOrderDetails = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { orderId } = req.params;
        console.log('🔍 Getting order details for:', orderId);

        if (!req.tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
        }

        const order = await req.tenantDb.order.findFirst({
            where: {
                id: orderId,
                createdById: req.user?.employeeId // Ensure user can only access their own orders
            },
            include: {
                chemist: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        address: true
                    }
                },
                createdBy: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                items: {
                    include: {
                        drug: {
                            select: {
                                name: true,
                                composition: true,
                                manufacturer: true,
                                category: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'asc'
                    }
                }
            }
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or you do not have permission to view this order'
            });
        }

        // Transform order items for frontend
        const transformedItems = order.items.map((item: any) => ({
            id: `${item.orderId}_${item.drugId}`, // Composite key as string
            name: item.drug?.name || 'Unknown Product',
            description: item.drug?.composition || '',
            manufacturer: item.drug?.manufacturer || '',
            category: item.drug?.category || '',
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice.toString()),
            subtotal: parseFloat(item.subtotal.toString())
        }));

        // Calculate totals
        const subtotal = transformedItems.reduce((sum, item) => sum + item.subtotal, 0);
        const itemCount = transformedItems.length;

        // Transform order details for frontend
        const orderDetails = {
            orderId: order.id,
            orderNumber: order.id,

            // Customer information
            customer: {
                id: order.chemist?.id,
                name: order.chemist?.name || 'Unknown Customer',
                email: order.chemist?.email,
                phone: order.chemist?.phone,
                address: order.chemist?.address
            },

            // Employee information
            createdBy: {
                name: `${order.createdBy?.firstName || ''} ${order.createdBy?.lastName || ''}`.trim() || 'Unknown Employee',
                email: order.createdBy?.email
            },

            // Order dates
            orderDate: order.orderDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            expectedDeliveryDate: order.deliveryDate ?
                order.deliveryDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }) : null,

            // Order status
            status: order.status || 'DRAFT',

            // Items and pricing
            items: transformedItems,
            itemCount: itemCount,
            subtotal: subtotal,
            totalAmount: parseFloat(order.totalAmount.toString()),

            // Special instructions
            specialInstructions: order.specialInstructions || '',

            // Timestamps
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        };

        res.status(200).json({
            success: true,
            message: 'Order details retrieved successfully',
            data: orderDetails
        });

    } catch (error) {
        console.error('❌ Error getting order details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve order details',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};