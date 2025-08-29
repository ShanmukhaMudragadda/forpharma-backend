
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
 * GET /api/orders/drugs
 * Get available drugs for order creation (simplified - just name and price)
 */
export const getDrugsForOrder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        console.log('💊 Getting drugs for order creation');

        if (!req.tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
        }

        const drugs = await req.tenantDb.drug.findMany({
            where: {
                isActive: true,
                isAvailable: true
            },
            select: {
                id: true,
                name: true,
                price: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        res.status(200).json({
            success: true,
            message: `Retrieved ${drugs.length} drugs`,
            data: drugs.map((drug: any) => ({
                id: drug.id,
                name: drug.name,
                price: drug.price ? parseFloat(drug.price.toString()) : 0
            }))
        });

    } catch (error) {
        console.error('❌ Error getting drugs for order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve drugs',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};