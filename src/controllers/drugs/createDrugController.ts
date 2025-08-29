import { Request, Response } from "express";

export const createDrug = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const {
            name,
            composition,
            manufacturer,
            indications,
            sideEffects,
            safetyAdvice,
            dosageForms,
            price,
            schedule,
            regulatoryApprovals,
            category,
            isAvailable = true,
            images,
            marketingMaterials
        } = req.body;

        const organizationId = req.user?.organizationId;
        const createdById = req.user?.id;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!name || !organizationId || !createdById) {
            return res.status(400).json({
                success: false,
                message: 'Drug name, organization ID, and creator ID are required'
            });
        }

        // Check if drug with the same name already exists
        const existingDrug = await tenantDb.drug.findFirst({
            where: {
                name: name.trim(),
                organizationId
            }
        });

        if (existingDrug) {
            return res.status(409).json({
                success: false,
                message: 'A drug with this name already exists'
            });
        }

        // Create the drug
        const drug = await tenantDb.drug.create({
            data: {
                organizationId,
                name: name.trim(),
                composition,
                manufacturer,
                indications,
                sideEffects,
                safetyAdvice,
                dosageForms,
                price: price ? parseFloat(price) : null,
                schedule,
                regulatoryApprovals,
                category,
                isAvailable,
                images,
                marketingMaterials,
                createdById
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Drug created successfully',
            drug
        });

    } catch (error: any) {
        console.error('Error creating drug:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while creating the drug',
            error: error.message
        });
    }
};
