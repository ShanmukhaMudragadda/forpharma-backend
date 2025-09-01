import { Request, Response } from 'express';
import { onboardNewOrganization } from '../scripts/onboardOrganization.js';

/**
 * Factory function that returns the Express middleware for creating organizations.
 * It injects the initialized SchemaManagementService into the middleware's scope.
 * @returns An Express RequestHandler middleware.
 */
export const createOrganizationController = async (req: Request, res: Response) => {
    try {
        const {
            name,
            email,
            address,
            website,
            adminEmail,
            adminPassword,
            adminFirstName,
            adminLastName
        } = req.body;

        // --- Input Validation ---
        if (!name || !email || !adminEmail || !adminPassword || !adminFirstName) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['name', 'email', 'adminEmail', 'adminPassword', 'adminFirstName']
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email) || !emailRegex.test(adminEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (adminPassword.length < 8) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters long'
            });
        }
        // --- End Input Validation ---

        // Call the onboarding script, passing the organization data AND the schemaService instance
        const result = await onboardNewOrganization({
            name,
            email,
            address,
            website,
            adminEmail,
            adminPassword,
            adminFirstName,
            adminLastName
        });

        // Respond with success
        res.status(201).json({
            message: 'Organization created successfully!',
            organizationId: result.organizationId,
            schemaName: result.schemaName,
            adminUserId: result.adminUserId
        });
    } catch (error: any) {
        console.error('Create organization error:', error);

        // Prisma P2002 error: Unique constraint violation (e.g., email already exists)
        if (error.code === 'P2002') {
            return res.status(409).json({
                error: 'Email already exists.',
                field: error.meta?.target // Indicates which field caused the unique violation
            });
        }

        // Generic error response for other unhandled exceptions
        res.status(500).json({
            error: 'Failed to create organization',
            details: error.message || 'An unexpected error occurred.'
        });
    }
};