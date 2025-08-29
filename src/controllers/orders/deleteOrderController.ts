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
 * DELETE /api/orders/:orderId
 * Hard delete order and its items (completely removes from database)
 */
export const deleteOrder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { orderId } = req.params;
        console.log('🗑️ Hard deleting order:', orderId);

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
            },
            include: {
                chemist: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (!existingOrder) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or you do not have permission to delete this order'
            });
        }

        // Store order info for response before deletion
        const orderInfo = {
            orderId: existingOrder.id,
            customerName: existingOrder.chemist?.name || 'Unknown Customer',
            status: existingOrder.status,
            totalAmount: parseFloat(existingOrder.totalAmount.toString())
        };

        // Hard delete order and its items in a transaction
        await req.tenantDb.$transaction(async (tx: any) => {
            console.log('🔥 Deleting order items for order:', orderId);

            // 1. Delete all order items first (foreign key constraint)
            const deletedItems = await tx.orderItem.deleteMany({
                where: { orderId: orderId }
            });

            console.log(`✅ Deleted ${deletedItems.count} order items`);

            console.log('🔥 Deleting order:', orderId);

            // 2. Delete the order itself
            const deletedOrder = await tx.order.delete({
                where: { id: orderId }
            });

            console.log('✅ Order deleted successfully');

            return deletedOrder;
        });

        res.status(200).json({
            success: true,
            message: 'Order and all its items have been permanently deleted',
            data: {
                deletedOrder: orderInfo,
                deletedAt: new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error('❌ Error deleting order:', error);

        // Check if it's a foreign key constraint error
        if (error.code === 'P2003') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete order due to existing references. Please contact support.'
            });
        }

        // Check if it's a record not found error
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Order not found or already deleted'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete order',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};