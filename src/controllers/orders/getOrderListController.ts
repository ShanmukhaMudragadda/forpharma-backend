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
 * GET /api/orders
 * List only orders created by the authenticated employee
 */
export const getOrderList = async (req: AuthenticatedRequest, res: Response) => {
    try {
        console.log('📋 Getting orders for employee:', req.user?.employeeId);

        if (!req.tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
        }

        const orders = await req.tenantDb.order.findMany({
            where: {
                createdById: req.user?.employeeId
            },
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
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Transform data to match frontend expectations
        const transformedOrders = orders.map((order: any) => ({
            orderId: order.id,
            customerName: order.chemist?.name || 'Unknown Customer',
            date: order.orderDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            amount: `₹${order.totalAmount.toLocaleString('en-IN')}`,
            status: order.status || 'DRAFT'
        }));

        res.status(200).json({
            success: true,
            message: `Retrieved ${transformedOrders.length} orders for employee`,
            data: transformedOrders
        });

    } catch (error) {
        console.error('❌ Error getting orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve orders',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};