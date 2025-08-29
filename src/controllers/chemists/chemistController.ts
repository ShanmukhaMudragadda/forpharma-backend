import { Request, Response } from 'express';

// Helper function - should be outside the controller
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const createChemistController = async (req: Request, res: Response) => {
    try {
        const {
            name,
            type,
            chemistChainId,
            territoryId,
            email,
            phone,
            address,
            city,
            state,
            pincode,
            latitude,
            longitude,
            description,
            profilePictureUrl,
            visitingHours
        } = req.body;

        const tenantDb = req.tenantDb;
        const organizationId = req.user?.organizationId;
        const createdById = req.user?.id;

        // Check if tenantDb exists
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        // Validation
        if (!name || !type || !territoryId || !organizationId || !createdById) {
            return res.status(400).json({
                success: false,
                message: 'Name, type, territory ID, organization ID, and creator ID are required'
            });
        }

        // Email validation if provided
        if (email && !isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Check if chemist with email already exists (only if email is provided)
        if (email) {
            const existingChemist = await tenantDb.chemist.findFirst({
                where: { email }
            });

            if (existingChemist) {
                return res.status(400).json({
                    success: false,
                    message: 'Chemist with this email already exists'
                });
            }
        }

        // Check if territory exists
        const territoryExists = await tenantDb.territory.findUnique({
            where: { id: territoryId }
        });

        if (!territoryExists) {
            return res.status(404).json({
                success: false,
                message: 'Territory not found'
            });
        }

        // Check if chemist chain exists (if provided)
        if (chemistChainId) {
            const chainExists = await tenantDb.chemistChain.findUnique({
                where: { id: chemistChainId }
            });

            if (!chainExists) {
                return res.status(404).json({
                    success: false,
                    message: 'Chemist chain not found'
                });
            }
        }

        // Create the chemist
        const newChemist = await tenantDb.chemist.create({
            data: {
                organizationId,
                name,
                type,
                chemistChainId,
                territoryId,
                email,
                phone,
                address,
                city,
                state,
                pincode,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                description,
                profilePictureUrl,
                visitingHours,
                createdById,
                isActive: true
            }
        });

        console.log(`Chemist "${name}" created successfully in tenant schema`);

        // Return success response
        return res.status(201).json({
            success: true,
            message: 'Chemist created successfully',
            data: newChemist
        });

    } catch (error: any) {
        console.error('Error in Chemist Creation:', error);
        // Generic error response
        return res.status(500).json({
            success: false,
            message: 'Chemist creation failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const updateChemist = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const chemistId = req.params.chemistId;
        const {
            name,
            type,
            chemistChainId,
            email,
            phone,
            address,
            city,
            state,
            pincode,
            latitude,
            longitude,
            description,
            profilePictureUrl,
            visitingHours
        } = req.body;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!chemistId) {
            return res.status(400).json({
                success: false,
                message: 'Chemist ID is required'
            });
        }

        // Check if chemist exists and is active
        const existingChemist = await tenantDb.chemist.findFirst({
            where: {
                id: chemistId,
                isActive: true
            }
        });

        if (!existingChemist) {
            return res.status(404).json({
                success: false,
                message: 'Chemist not found or is not active'
            });
        }

        // Update the chemist
        const updatedChemist = await tenantDb.chemist.update({
            where: { id: chemistId },
            data: {
                name,
                type,
                chemistChainId,
                email,
                phone,
                address,
                city,
                state,
                pincode,
                latitude: latitude ? parseFloat(latitude) : undefined,
                longitude: longitude ? parseFloat(longitude) : undefined,
                description,
                profilePictureUrl,
                visitingHours
            },
            select: {
                id: true,
                organizationId: true,
                name: true,
                type: true,
                chemistChainId: true,
                territoryId: true,
                email: true,
                phone: true,
                address: true,
                city: true,
                state: true,
                pincode: true,
                latitude: true,
                longitude: true,
                description: true,
                profilePictureUrl: true,
                visitingHours: true,
                isActive: true,
                createdAt: true,
                updatedAt: true
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Chemist details updated successfully',
            chemist: updatedChemist
        });

    } catch (error: any) {
        console.error('Error updating chemist:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating chemist details',
            error: error.message
        });
    }
};

// Soft delete chemist (set isActive to false)
export const deleteChemist = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const chemistId = req.params.chemistId;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!chemistId) {
            return res.status(400).json({
                success: false,
                message: 'Chemist ID is required'
            });
        }

        // Check if chemist exists and is active
        const existingChemist = await tenantDb.chemist.findFirst({
            where: {
                id: chemistId,
                isActive: true
            }
        });

        if (!existingChemist) {
            return res.status(404).json({
                success: false,
                message: 'Chemist not found or is already inactive'
            });
        }

        // Perform soft delete by setting isActive to false
        const deactivatedChemist = await tenantDb.chemist.update({
            where: { id: chemistId },
            data: {
                isActive: false
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                type: true,
                isActive: true,
                updatedAt: true
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Chemist deactivated successfully',
            chemist: deactivatedChemist
        });

    } catch (error: any) {
        console.error('Error deleting chemist:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while deactivating the chemist',
            error: error.message
        });
    }
};

export const getChemistListController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const userId = req.user?.id;
        const organizationId = req.user?.organizationId;

        // Check if tenantDb exists
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        // Validation
        if (!userId || !organizationId) {
            return res.status(400).json({
                success: false,
                message: 'User ID and organization ID are required'
            });
        }

        // Step 1: Get user's territories (active assignments only)
        const userTerritories = await tenantDb.employeeTerritory.findMany({
            where: {
                employeeId: userId,
                unassignedAt: null // Only active territory assignments
            },
            select: {
                territoryId: true,
                isPrimary: true
            }
        });

        if (userTerritories.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No territories assigned to user',
                data: []
            });
        }

        // Extract territory IDs with proper typing
        const territoryIds = userTerritories.map((ut: { territoryId: string }) => ut.territoryId);

        // Step 2: Get all chemists in user's territories
        const chemists = await tenantDb.chemist.findMany({
            where: {
                territoryId: {
                    in: territoryIds
                },
                isActive: true
            },
            select: {
                id: true,
                name: true,
                type: true,
                email: true,
                phone: true,
                address: true,
                city: true,
                state: true,
                pincode: true,
                visitingHours: true,
                chemistChain: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                territory: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Format the response
        const chemistList = chemists.map((chemist: any) => ({
            chemistId: chemist.id,
            chemistName: chemist.name,
            type: chemist.type,
            email: chemist.email,
            phone: chemist.phone,
            address: formatAddress(chemist),
            visitingHours: chemist.visitingHours,
            chainName: chemist.chemistChain?.name || null,
            territoryName: chemist.territory.name
        }));

        // Add summary statistics
        const summary = {
            totalTerritories: territoryIds.length,
            totalChemists: chemistList.length
        };

        return res.status(200).json({
            success: true,
            message: 'Chemists list retrieved successfully',
            summary,
            data: chemistList
        });

    } catch (error: any) {
        console.error('Error in getChemistList:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve chemists list',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Helper function to format address
const formatAddress = (chemist: any): string => {
    const parts = [
        chemist.address,
        chemist.city,
        chemist.state,
        chemist.pincode
    ].filter(Boolean);

    return parts.join(', ');
};

export const getChemistDetails = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const chemistId = req.params.chemistId;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!chemistId) {
            return res.status(400).json({
                success: false,
                message: 'Chemist ID is required'
            });
        }

        // Fetch chemist details with all related information
        const chemist = await tenantDb.chemist.findFirst({
            where: {
                id: chemistId,
                isActive: true // Assuming you want only active chemists
            },
            select: {
                id: true,
                organizationId: true,
                name: true,
                type: true,
                email: true,
                phone: true,
                address: true,
                city: true,
                state: true,
                pincode: true,
                latitude: true,
                longitude: true,
                description: true,
                profilePictureUrl: true,
                visitingHours: true,
                chemistChain: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                territory: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!chemist) {
            return res.status(404).json({
                success: false,
                message: 'Chemist not found or is not active'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Chemist details fetched successfully',
            chemist
        });

    } catch (error: any) {
        console.error('Error fetching chemist details:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching chemist details',
            error: error.message
        });
    }
};