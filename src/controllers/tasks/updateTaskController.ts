import { Request, Response } from 'express';

export const updateTaskController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const userId = req.user?.id;
        const { task_id, type } = req.params;
        const { date, startTime, endTime, location } = req.body;

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

        if (!task_id || !type) {
            return res.status(400).json({
                success: false,
                message: 'Task ID and task type are required'
            });
        }

        // At least one field should be provided for update
        if (!date || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'date, startTime, endTime are required for update'
            });
        }

        let updatedTask;
        const updateData: any = {};

        // Prepare update data with proper date/time formatting
        if (date) {
            const taskDate = new Date(date);
            if (isNaN(taskDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Expected format: YYYY-MM-DD'
                });
            }
            updateData.taskDate = taskDate;
        }

        if (startTime) {
            const taskStartTime = new Date(`1970-01-01T${startTime}`);
            if (isNaN(taskStartTime.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid start time format. Expected format: HH:MM:SS'
                });
            }
            updateData.startTime = taskStartTime;
        }

        if (endTime) {
            const taskEndTime = new Date(`1970-01-01T${endTime}`);
            if (isNaN(taskEndTime.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid end time format. Expected format: HH:MM:SS'
                });
            }
            updateData.endTime = taskEndTime;
        }

        // Update based on task type
        if (type.toLowerCase() === 'doctor') {
            // Check if doctor task exists and user has permission
            const doctorTask = await tenantDb.doctorTask.findFirst({
                where: {
                    id: task_id,
                    isActive: true
                }
            });

            if (!doctorTask) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor task not found or has been deleted'
                });
            }

            // Verify ownership
            if (doctorTask.employeeId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to update this task'
                });
            }

            // Update the doctor task
            updatedTask = await tenantDb.doctorTask.update({
                where: {
                    id: task_id
                },
                data: {
                    ...updateData,
                    completionStatus: 'RESCHEDULED', // Set status to rescheduled
                    updatedAt: new Date()
                },
                include: {
                    doctor: {
                        select: {
                            name: true,
                            specialization: true
                        }
                    },
                    planner: {
                        select: {
                            startDate: true,
                            endDate: true
                        }
                    }
                }
            });

        } else if (type.toLowerCase() === 'chemist') {
            // Check if chemist task exists and user has permission
            const chemistTask = await tenantDb.chemistTask.findFirst({
                where: {
                    id: task_id,
                    isActive: true
                }
            });

            if (!chemistTask) {
                return res.status(404).json({
                    success: false,
                    message: 'Chemist task not found or has been deleted'
                });
            }

            // Verify ownership
            if (chemistTask.employeeId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to update this task'
                });
            }

            // Update the chemist task
            updatedTask = await tenantDb.chemistTask.update({
                where: {
                    id: task_id
                },
                data: {
                    ...updateData,
                    completionStatus: 'RESCHEDULED',
                    updatedAt: new Date()
                },
                include: {
                    chemist: {
                        select: {
                            name: true,
                            type: true
                        }
                    },
                    planner: {
                        select: {
                            startDate: true,
                            endDate: true
                        }
                    }
                }
            });

        } else if (type.toLowerCase() === 'tourplan') {
            // Check if tour plan task exists and user has permission
            const tourPlanTask = await tenantDb.tourPlanTask.findFirst({
                where: {
                    id: task_id,
                    isActive: true
                }
            });

            if (!tourPlanTask) {
                return res.status(404).json({
                    success: false,
                    message: 'Tour plan task not found or has been deleted'
                });
            }

            // Verify ownership
            if (tourPlanTask.employeeId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to update this task'
                });
            }

            // Add location to update data if provided
            if (location) {
                updateData.location = location;
            }

            // Update the tour plan task
            updatedTask = await tenantDb.tourPlanTask.update({
                where: {
                    id: task_id
                },
                data: {
                    ...updateData,
                    completionStatus: 'RESCHEDULED',
                    updatedAt: new Date()
                },
                include: {
                    tourPlan: {
                        select: {
                            name: true,
                            description: true
                        }
                    },
                    planner: {
                        select: {
                            startDate: true,
                            endDate: true
                        }
                    }
                }
            });

        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid task type. Supported types: doctor, chemist, tourplan'
            });
        }


        return res.status(200).json({
            success: true,
            message: `${type.charAt(0).toUpperCase() + type.slice(1)} task updated successfully`,
            data: updatedTask
        });

    } catch (error) {
        console.error('Error updating task:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the task',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};