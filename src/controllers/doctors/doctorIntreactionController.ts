
import { Request, Response } from 'express';

// Helper function - should be outside the controller
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// DoctorInteraction

// Create a new doctor interaction
export const createDoctorInteraction = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const {
            doctorId,
            hospitalId,
            interactionType,
            startTime,
            endTime,
            purpose,
            outcome,
            comments,
            rating,
            doctorTaskId
        } = req.body;
        const employeeId = req.user?.id; // Assuming user info is attached to request

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!doctorId || !interactionType || !startTime) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID, interaction type, and start time are required'
            });
        }

        if (!employeeId) {
            return res.status(401).json({
                success: false,
                message: 'User authentication required'
            });
        }

        // Validate rating if provided
        if (rating !== undefined) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Check if doctor exists
        const doctorExists = await tenantDb.doctor.findUnique({
            where: { id: doctorId }
        });

        if (!doctorExists) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
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

        // Check if hospital exists (if provided)
        if (hospitalId) {
            const hospitalExists = await tenantDb.hospital.findUnique({
                where: { id: hospitalId }
            });

            if (!hospitalExists) {
                return res.status(404).json({
                    success: false,
                    message: 'Hospital not found'
                });
            }
        }

        // Check if task exists (if provided)
        if (doctorTaskId) {
            const taskExists = await tenantDb.doctorTask.findUnique({
                where: { id: doctorTaskId }
            });

            if (!taskExists) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor task not found'
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
        const interaction = await tenantDb.doctorInteraction.create({
            data: {
                doctorId,
                employeeId,
                hospitalId,
                interactionType,
                startTime: startDateTime,
                endTime: endDateTime,
                purpose: purpose?.trim(),
                outcome: outcome?.trim(),
                comments: comments?.trim(),
                rating,
                doctorTaskId
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true,
                        designation: true
                    }
                },
                employee: {
                    select: {
                        id: true,
                        email: true,
                        role: true
                    }
                },
                hospital: hospitalId ? {
                    select: {
                        id: true,
                        name: true,
                        city: true
                    }
                } : false,
                DoctorTask: doctorTaskId ? {
                    select: {
                        id: true,
                    }
                } : false
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Doctor interaction created successfully',
            interaction
        });

    } catch (error: any) {
        console.error('Error creating doctor interaction:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while creating the interaction',
            error: error.message
        });
    }
};

// Get all interactions for a specific doctor
export const getInteractionsForDoctor = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const doctorId = req.params.doctorId;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!doctorId) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID is required'
            });
        }

        // Check if doctor exists
        const doctorExists = await tenantDb.doctor.findUnique({
            where: { id: doctorId },
            select: {
                id: true,
                name: true,
                specialization: true,
                designation: true
            }
        });

        if (!doctorExists) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Build where clause
        const where: any = { doctorId };


        // Fetch interactions
        const interactions = await tenantDb.doctorInteraction.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        firstName: true,
                        lastName: true
                    }
                },
                hospital: {
                    select: {
                        id: true,
                        name: true,
                        city: true
                    }
                }
            },
            orderBy: {
                startTime: 'desc'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Doctor interactions fetched successfully',
            data: {
                doctor: doctorExists,
                interactions,
            }
        });

    } catch (error: any) {
        console.error('Error fetching doctor interactions:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching doctor interactions',
            error: error.message
        });
    }
};

// Get all interactions by an employee
export const getInteractionsByEmployee = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const employeeId = req.params.employeeId;
        const {
            doctorId,
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
        if (doctorId) where.doctorId = doctorId;
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
        const totalCount = await tenantDb.doctorInteraction.count({ where });

        // Get today's interactions count
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = await tenantDb.doctorInteraction.count({
            where: {
                employeeId,
                startTime: { gte: today }
            }
        });

        // Fetch interactions
        const interactions = await tenantDb.doctorInteraction.findMany({
            where,
            skip,
            take,
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true,
                        designation: true
                    }
                },
                hospital: {
                    select: {
                        id: true,
                        name: true,
                        city: true
                    }
                }
            },
            orderBy: {
                startTime: 'desc'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Employee interactions fetched successfully',
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
        console.error('Error fetching employee interactions:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching employee interactions',
            error: error.message
        });
    }
};

// Update a doctor interaction
export const updateDoctorInteraction = async (req: Request, res: Response) => {
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
        const existingInteraction = await tenantDb.doctorInteraction.findUnique({
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
        const updatedInteraction = await tenantDb.doctorInteraction.update({
            where: { id: interactionId },
            data: {
                endTime: endTime ? new Date(endTime) : undefined,
                purpose: purpose?.trim(),
                outcome: outcome?.trim(),
                comments: comments?.trim(),
                rating
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true
                    }
                },
                employee: {
                    select: {
                        id: true,
                        email: true,
                        role: true
                    }
                },
                hospital: {
                    select: {
                        id: true,
                        name: true,
                        city: true
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

// Delete a doctor interaction
export const deleteDoctorInteraction = async (req: Request, res: Response) => {
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
        // const interaction = await tenantDb.doctorInteraction.findUnique({
        //     where: { id: interactionId },
        //     include: {
        //         SampleDistribution: true
        //     }
        // });

        // if (!interaction) {
        //     return res.status(404).json({
        //         success: false,
        //         message: 'Interaction not found'
        //     });
        // }

        // Check if interaction has related distributions
        // if (interaction.DoctorDistribution && interaction.DoctorDistribution.length > 0) {
        //     return res.status(400).json({
        //         success: false,
        //         message: 'Cannot delete interaction with associated distributions'
        //     });
        // }

        // Check permission (only creator or admin can delete)
        // if (interaction.employeeId !== userId && userRole !== 'ADMIN') {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'You do not have permission to delete this interaction'
        //     });
        // }

        // Delete the interaction
        await tenantDb.doctorInteraction.delete({
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






