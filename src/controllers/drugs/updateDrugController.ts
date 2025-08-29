import { Request, Response } from "express";

export const updateDrug = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const drugId = req.params.drugId;
        const updateData = req.body;
        const userId = req.user?.id;

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

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User authentication required'
            });
        }

        // Check if drug exists
        const existingDrug = await tenantDb.drug.findUnique({
            where: { id: drugId }
        });

        if (!existingDrug) {
            return res.status(404).json({
                success: false,
                message: 'Drug not found'
            });
        }

        // Remove fields that shouldn't be updated directly
        const { id, organizationId, createdAt, createdById, ...allowedUpdates } = updateData;

        // Update the drug
        const updatedDrug = await tenantDb.drug.update({
            where: { id: drugId },
            data: {
                ...allowedUpdates,
                updatedAt: new Date()
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Drug updated successfully',
            drug: updatedDrug
        });

    } catch (error: any) {
        console.error('Error updating drug:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the drug',
            error: error.message
        });
    }
};
