import { Request, Response } from 'express';

// Helper function - should be outside the controller
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};


// ChemistInteraction Controllers

// Create a new chemist interaction
export const createChemistInteraction = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const {
            chemistId,
            interactionType,
            startTime,
            endTime,
            purpose,
            outcome,
            comments,
            rating,
            chemistTaskId
        } = req.body;
        const employeeId = req.user?.id; // Assuming user info is attached to request

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!chemistId || !interactionType || !startTime) {
            return res.status(400).json({
                success: false,
                message: 'Chemist ID, interaction type, and start time are required'
            });
        }

        if (!employeeId) {
            return res.status(401).json({
                success: false,
                message: 'User authentication required'
            });
        }

        // Validate rating if provided
        if (rating !== undefined && (rating < 1 || rating > 5)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Check if chemist exists
        const chemistExists = await tenantDb.chemist.findUnique({
            where: { id: chemistId }
        });

        if (!chemistExists) {
            return res.status(404).json({
                success: false,
                message: 'Chemist not found'
            });
        }

        // Check if employee exists
        const employeeExists = await tenantDb.employee.findUnique({
            where: { id: employeeId }
        });

        if (!employeeExists) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Check if task exists (if provided)
        if (chemistTaskId) {
            const taskExists = await tenantDb.chemistTask.findUnique({
                where: { id: chemistTaskId }
            });

            if (!taskExists) {
                return res.status(404).json({
                    success: false,
                    message: 'Chemist task not found'
                });
            }
        }

        // Validate start and end times
        const startDateTime = new Date(startTime);
        const endDateTime = endTime ? new Date(endTime) : null;

        if (endDateTime && endDateTime <= startDateTime) {
            return res.status(400).json({
                success: false,
                message: 'End time must be after start time'
            });
        }

        // Create the interaction
        const interaction = await tenantDb.chemistInteraction.create({
            data: {
                chemistId,
                employeeId,
                interactionType,
                startTime: startDateTime,
                endTime: endDateTime,
                purpose: purpose?.trim(),
                outcome: outcome?.trim(),
                comments: comments?.trim(),
                rating,
                chemistTaskId
            },
            include: {
                chemist: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
                employee: {
                    select: {
                        id: true,
                        email: true,
                        role: true
                    }
                },
                chemistTask: chemistTaskId ? {
                    select: {
                        id: true,
                        taskStatus: true
                    }
                } : false
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Chemist interaction created successfully',
            interaction
        });

    } catch (error: any) {
        console.error('Error creating chemist interaction:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while creating the interaction',
            error: error.message
        });
    }
};

// Get all interactions for a specific chemist
export const getInteractionsForChemist = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const chemistId = req.params.chemistId;
        const {
            interactionType,
            employeeId,
            startDate,
            endDate,
            page = 1,
            limit = 10
        } = req.query;

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

        // Check if chemist exists
        const chemistExists = await tenantDb.chemist.findUnique({
            where: { id: chemistId },
            select: {
                id: true,
                name: true,
                type: true
            }
        });

        if (!chemistExists) {
            return res.status(404).json({
                success: false,
                message: 'Chemist not found'
            });
        }

        // Build where clause
        const where: any = { chemistId };
        if (interactionType) where.interactionType = interactionType;
        if (employeeId) where.employeeId = employeeId;

        // Date range filter
        if (startDate || endDate) {
            where.startTime = {};
            if (startDate) where.startTime.gte = new Date(startDate as string);
            if (endDate) where.startTime.lte = new Date(endDate as string);
        }

        // Calculate pagination
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        // Get total count
        const totalCount = await tenantDb.chemistInteraction.count({ where });

        // Get interaction statistics
        const stats = await tenantDb.chemistInteraction.aggregate({
            where: { chemistId },
            _count: {
                _all: true
            },
            _avg: {
                rating: true
            }
        });

        // Get interaction type breakdown
        const interactionTypes = await tenantDb.chemistInteraction.groupBy({
            by: ['interactionType'],
            where: { chemistId },
            _count: {
                _all: true
            }
        });

        // Fetch interactions
        const interactions = await tenantDb.chemistInteraction.findMany({
            where,
            skip,
            take,
            include: {
                employee: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: {
                startTime: 'desc'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Chemist interactions fetched successfully',
            data: {
                chemist: chemistExists,
                statistics: {
                    totalInteractions: stats._count._all,
                    averageRating: stats._avg.rating,
                    byType: interactionTypes
                },
                interactions,
                pagination: {
                    total: totalCount,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(totalCount / Number(limit))
                }
            }
        });

    } catch (error: any) {
        console.error('Error fetching chemist interactions:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching chemist interactions',
            error: error.message
        });
    }
};

// Get all chemist interactions by an employee
export const getChemistInteractionsByEmployee = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const employeeId = req.params.employeeId;
        const {
            chemistId,
            interactionType,
            startDate,
            endDate,
            page = 1,
            limit = 10
        } = req.query;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        // Check if employee exists
        const employeeExists = await tenantDb.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                email: true,
                role: true
            }
        });

        if (!employeeExists) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Build where clause
        const where: any = { employeeId };
        if (chemistId) where.chemistId = chemistId;
        if (interactionType) where.interactionType = interactionType;

        // Date range filter
        if (startDate || endDate) {
            where.startTime = {};
            if (startDate) where.startTime.gte = new Date(startDate as string);
            if (endDate) where.startTime.lte = new Date(endDate as string);
        }

        // Calculate pagination
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        // Get total count
        const totalCount = await tenantDb.chemistInteraction.count({ where });

        // Get today's interactions count
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = await tenantDb.chemistInteraction.count({
            where: {
                employeeId,
                startTime: { gte: today }
            }
        });

        // Fetch interactions
        const interactions = await tenantDb.chemistInteraction.findMany({
            where,
            skip,
            take,
            include: {
                chemist: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: {
                startTime: 'desc'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Employee chemist interactions fetched successfully',
            data: {
                employee: employeeExists,
                statistics: {
                    totalInteractions: totalCount,
                    todayInteractions: todayCount
                },
                interactions,
                pagination: {
                    total: totalCount,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(totalCount / Number(limit))
                }
            }
        });

    } catch (error: any) {
        console.error('Error fetching employee chemist interactions:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching employee chemist interactions',
            error: error.message
        });
    }
};

// Update a chemist interaction
export const updateChemistInteraction = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const interactionId = req.params.interactionId;
        const {
            endTime,
            purpose,
            outcome,
            comments,
            rating
        } = req.body;
        const userId = req.user?.id; // Current user making the update

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!interactionId) {
            return res.status(400).json({
                success: false,
                message: 'Interaction ID is required'
            });
        }

        // Check if interaction exists
        const existingInteraction = await tenantDb.chemistInteraction.findUnique({
            where: { id: interactionId }
        });

        if (!existingInteraction) {
            return res.status(404).json({
                success: false,
                message: 'Interaction not found'
            });
        }

        // Check if user has permission to update (only creator can update)
        if (existingInteraction.employeeId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to update this interaction'
            });
        }

        // Validate rating if provided
        if (rating !== undefined && (rating < 1 || rating > 5)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Validate end time if provided
        if (endTime) {
            const endDateTime = new Date(endTime);
            if (endDateTime <= existingInteraction.startTime) {
                return res.status(400).json({
                    success: false,
                    message: 'End time must be after start time'
                });
            }
        }

        // Update the interaction
        const updatedInteraction = await tenantDb.chemistInteraction.update({
            where: { id: interactionId },
            data: {
                endTime: endTime ? new Date(endTime) : undefined,
                purpose: purpose?.trim(),
                outcome: outcome?.trim(),
                comments: comments?.trim(),
                rating
            },
            include: {
                chemist: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
                employee: {
                    select: {
                        id: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Interaction updated successfully',
            interaction: updatedInteraction
        });

    } catch (error: any) {
        console.error('Error updating interaction:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the interaction',
            error: error.message
        });
    }
};

// Delete a chemist interaction
export const deleteChemistInteraction = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const interactionId = req.params.interactionId;
        const userId = req.user?.id; // Current user making the request
        const userRole = req.user?.role; // Assuming role is available

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!interactionId) {
            return res.status(400).json({
                success: false,
                message: 'Interaction ID is required'
            });
        }

        // Check if interaction exists
        const interaction = await tenantDb.chemistInteraction.findUnique({
            where: { id: interactionId }
        });

        if (!interaction) {
            return res.status(404).json({
                success: false,
                message: 'Interaction not found'
            });
        }

        // Check permission (only creator or admin can delete)
        if (interaction.employeeId !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this interaction'
            });
        }

        // Delete the interaction
        await tenantDb.chemistInteraction.delete({
            where: { id: interactionId }
        });

        return res.status(200).json({
            success: true,
            message: 'Interaction deleted successfully'
        });

    } catch (error: any) {
        console.error('Error deleting interaction:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the interaction',
            error: error.message
        });
    }
};