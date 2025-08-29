import { Request, Response } from 'express';

// Get all drugs (no server-side filtering)
export const getDrugList = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        // Simple where clause - only get active drugs
        const where = {
            isActive: true
        };

        // Fetch ALL active drugs (no filtering on server)
        const drugs = await tenantDb.drug.findMany({
            where,
            select: {
                id: true,
                name: true,
                composition: true,
                manufacturer: true,
                indications: true,
                sideEffects: true,
                safetyAdvice: true,
                dosageForms: true,
                price: true,
                schedule: true,
                regulatoryApprovals: true,
                category: true,
                isAvailable: true,
                images: true,
                marketingMaterials: true,
                createdAt: true,
                updatedAt: true,
                isActive: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Calculate summary statistics
        const totalCount = drugs.length;
        const availableCount = drugs.filter(drug => drug.isAvailable).length;

        return res.status(200).json({
            success: true,
            message: 'All drugs retrieved successfully',
            summary: {
                totalDrugs: totalCount,
                availableCount,
                outOfStockCount: totalCount - availableCount
            },
            data: drugs
        });

    } catch (error: any) {
        console.error('Error in getDrugList:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve drugs list',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};