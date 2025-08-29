import { Request, Response } from "express";

/**
 * GET /api/tourplan/list
 * Get all tour plans
 */
export const getTourPlansController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const userId = req.user?.id;

        // Validation
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        const tourPlans = await tenantDb.tourPlan.findMany();

        return res.status(200).json({
            success: true,
            message: 'Tour plans retrieved successfully',
            tourPlans
        });

    } catch (error) {
        console.error('Error fetching tour plans:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching tour plans',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};