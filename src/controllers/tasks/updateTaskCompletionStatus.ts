// updateTaskCompletionStatusController.ts

import express from 'express'
import { Request, Response } from 'express'

export const updateTaskCompletionStatusController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const user_id = req.user?.id;
        const { task_id, type } = req.params; // Expecting /api/tasks/:type/:task_id/status
        const { completionStatus } = req.body;

        if (!user_id) {
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

        if (!completionStatus) {
            return res.status(400).json({
                success: false,
                message: 'Completion status is required'
            });
        }

        // Validate completion status
        const validStatuses = ['PENDING', 'COMPLETED', 'RESCHEDULED'];
        if (!validStatuses.includes(completionStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid completion status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        let updatedTask;
        const taskType = type.toLowerCase();

        if (taskType === 'doctor') {
            // Check if doctor task exists and is active
            const doctorTask = await tenantDb.doctorTask.findFirst({
                where: {
                    id: task_id,
                    isActive: true
                },
                include: {
                    doctor: {
                        select: {
                            id: true,
                            name: true,
                            specialization: true,
                            email: true,
                            phone: true
                        }
                    },
                    planner: {
                        select: {
                            id: true,
                            startDate: true,
                            endDate: true,
                            approvalStatus: true
                        }
                    }
                }
            });

            if (!doctorTask) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor task not found or has been deleted'
                });
            }

            // Verify ownership
            if (doctorTask.employeeId !== user_id) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to update this task'
                });
            }

            // Check if task planner is approved before allowing completion
            // if (completionStatus === 'COMPLETED' && doctorTask.planner.approvalStatus !== 'APPROVED') {
            //     return res.status(400).json({
            //         success: false,
            //         message: 'Cannot mark task as completed. Task planner must be approved first.'
            //     });
            // }

            // Update the doctor task
            updatedTask = await tenantDb.doctorTask.update({
                where: {
                    id: task_id
                },
                data: {
                    completionStatus: completionStatus,
                    updatedAt: new Date()
                },
                include: {
                    doctor: {
                        select: {
                            id: true,
                            name: true,
                            specialization: true,
                            email: true,
                            phone: true
                        }
                    },
                    planner: {
                        select: {
                            id: true,
                            startDate: true,
                            endDate: true,
                            approvalStatus: true
                        }
                    }
                }
            });

        } else if (taskType === 'chemist') {
            // Check if chemist task exists and is active
            const chemistTask = await tenantDb.chemistTask.findFirst({
                where: {
                    id: task_id,
                    isActive: true
                },
                include: {
                    chemist: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            email: true,
                            phone: true,
                            address: true
                        }
                    },
                    planner: {
                        select: {
                            id: true,
                            startDate: true,
                            endDate: true,
                            approvalStatus: true
                        }
                    }
                }
            });

            if (!chemistTask) {
                return res.status(404).json({
                    success: false,
                    message: 'Chemist task not found or has been deleted'
                });
            }

            // Verify ownership
            if (chemistTask.employeeId !== user_id) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to update this task'
                });
            }

            // Check if task planner is approved before allowing completion
            // if (completionStatus === 'COMPLETED' && chemistTask.planner.approvalStatus !== 'APPROVED') {
            //     return res.status(400).json({
            //         success: false,
            //         message: 'Cannot mark task as completed. Task planner must be approved first.'
            //     });
            // }

            // Update the chemist task
            updatedTask = await tenantDb.chemistTask.update({
                where: {
                    id: task_id
                },
                data: {
                    completionStatus: completionStatus,
                    updatedAt: new Date()
                },
                include: {
                    chemist: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            email: true,
                            phone: true,
                            address: true
                        }
                    },
                    planner: {
                        select: {
                            id: true,
                            startDate: true,
                            endDate: true,
                            approvalStatus: true
                        }
                    }
                }
            });

        } else if (taskType === 'tourplan') {
            // Check if tour plan task exists and is active
            const tourPlanTask = await tenantDb.tourPlanTask.findFirst({
                where: {
                    id: task_id,
                    isActive: true
                },
                include: {
                    tourPlan: {
                        select: {
                            id: true,
                            name: true,
                            description: true
                        }
                    },
                    planner: {
                        select: {
                            id: true,
                            startDate: true,
                            endDate: true,
                            approvalStatus: true
                        }
                    }
                }
            });

            if (!tourPlanTask) {
                return res.status(404).json({
                    success: false,
                    message: 'Tour plan task not found or has been deleted'
                });
            }

            // Verify ownership
            if (tourPlanTask.employeeId !== user_id) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to update this task'
                });
            }

            // Check if task planner is approved before allowing completion
            // if (completionStatus === 'COMPLETED' && tourPlanTask.planner.approvalStatus !== 'APPROVED') {
            //     return res.status(400).json({
            //         success: false,
            //         message: 'Cannot mark task as completed. Task planner must be approved first.'
            //     });
            // }

            // Update the tour plan task
            updatedTask = await tenantDb.tourPlanTask.update({
                where: {
                    id: task_id
                },
                data: {
                    completionStatus: completionStatus,
                    updatedAt: new Date()
                },
                include: {
                    tourPlan: {
                        select: {
                            id: true,
                            name: true,
                            description: true
                        }
                    },
                    planner: {
                        select: {
                            id: true,
                            startDate: true,
                            endDate: true,
                            approvalStatus: true
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

        // Determine success message based on status
        let successMessage = `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} task status updated successfully`;
        if (completionStatus === 'COMPLETED') {
            successMessage = `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} task marked as completed`;
        } else if (completionStatus === 'RESCHEDULED') {
            successMessage = `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} task marked as rescheduled`;
        } else if (completionStatus === 'PENDING') {
            successMessage = `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} task marked as pending`;
        }


        return res.status(200).json({
            success: true,
            message: successMessage,
            data: {
                task: updatedTask,
                taskType: taskType,
                previousStatus: updatedTask ?
                    (taskType === 'doctor' || taskType === 'chemist' || taskType === 'tourplan' ?
                        'PENDING' : 'UNKNOWN') : 'UNKNOWN',
                newStatus: completionStatus
            }
        });

    } catch (error) {
        console.error('Error occurred during task completion status update:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the task completion status',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};