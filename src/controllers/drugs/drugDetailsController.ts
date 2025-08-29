import { Request, Response } from "express";

export const getDrugDetails = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const drugId = req.params.drugId;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!drugId) {
            return res.status(400).json({
                success: false,
                message: 'Drug ID is required'
            });
        }

        // Fetch drug details
        const drug = await tenantDb.drug.findFirst({
            where: {
                id: drugId,
                isActive: true
            },
            select: {
                id: true,
                organizationId: true,
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
            }
        });

        if (!drug) {
            return res.status(404).json({
                success: false,
                message: 'Drug not found or is not active'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Drug details fetched successfully',
            drug
        });

    } catch (error: any) {
        console.error('Error fetching drug details:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching drug details',
            error: error.message
        });
    }
};