import express from 'express';
import { Request, Response } from 'express';

/**
 * POST /api/tourplan/create
 * Create a new tour plan
 */
export const createTourPlanController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const userId = req.user?.id;
        const { name, description } = req.body;

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

        // Validate required fields
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Tour plan name is required and must be a non-empty string'
            });
        }

        // Validate name length (max 255 characters as per database schema)
        if (name.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Tour plan name must not exceed 255 characters'
            });
        }

        // Check if a tour plan with the same name already exists
        const existingTourPlan = await tenantDb.tourPlan.findFirst({
            where: {
                name: name.trim()
            }
        });

        if (existingTourPlan) {
            return res.status(409).json({
                success: false,
                message: 'A tour plan with this name already exists'
            });
        }

        // Create the tour plan
        const tourPlan = await tenantDb.tourPlan.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Tour plan created successfully',
            data: tourPlan
        });

    } catch (error) {
        console.error('Error creating tour plan:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while creating the tour plan',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

