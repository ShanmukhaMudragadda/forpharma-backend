// updateTaskPlannerStatusController.ts

import express from 'express'
import { Request, Response } from 'express'

export const updateTaskPlannerStatusController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const user_id = req.user?.id;

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

        const taskPlannerId = req.params.taskPlanner_id;
        const { approvalStatus } = req.body;

        if (!taskPlannerId) {
            return res.status(400).json({
                success: false,
                message: 'Task planner ID is required'
            });
        }

        if (!approvalStatus) {
            return res.status(400).json({
                success: false,
                message: 'Approval status is required'
            });
        }

        // Validate approval status
        const validStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'];
        if (!validStatuses.includes(approvalStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid approval status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Check if task planner exists and is active
        const taskPlanner = await tenantDb.taskPlanner.findFirst({
            where: {
                id: taskPlannerId,
                isActive: true
            },
            select: {
                id: true,
                employeeId: true,
                approvalStatus: true,
                startDate: true,
                endDate: true,
                _count: {
                    select: {
                        doctorTasks: {
                            where: { isActive: true }
                        },
                        chemistTasks: {
                            where: { isActive: true }
                        },
                        tourPlanTasks: {
                            where: { isActive: true }
                        }
                    }
                }
            }
        });

        if (!taskPlanner) {
            return res.status(404).json({
                success: false,
                message: 'Task planner not found or has been deleted'
            });
        }

        // Verify ownership
        if (taskPlanner.employeeId !== user_id) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to update this task planner'
            });
        }


        // Special validation for submitting for approval
        if (approvalStatus === 'PENDING_APPROVAL') {
            const totalTasks =
                taskPlanner._count.doctorTasks +
                taskPlanner._count.chemistTasks +
                taskPlanner._count.tourPlanTasks;

            if (totalTasks === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot submit for approval. Task planner must have at least one task.'
                });
            }
        }

        // Use a transaction to update everything
        const updatedData = await tenantDb.$transaction(async (prisma) => {

            // Update all associated doctor tasks
            const updatedDoctorTasks = await prisma.doctorTask.updateMany({
                where: {
                    plannerId: taskPlannerId,
                    isActive: true
                },
                data: {
                    approvalStatus: approvalStatus,
                    updatedAt: new Date()
                }
            });

            // Update all associated chemist tasks
            const updatedChemistTasks = await prisma.chemistTask.updateMany({
                where: {
                    plannerId: taskPlannerId,
                    isActive: true
                },
                data: {
                    approvalStatus: approvalStatus,
                    updatedAt: new Date()
                }
            });

            // Update all associated tour plan tasks
            const updatedTourPlanTasks = await prisma.tourPlanTask.updateMany({
                where: {
                    plannerId: taskPlannerId,
                    isActive: true
                },
                data: {
                    approvalStatus: approvalStatus,
                    updatedAt: new Date()
                }
            });

            // Finally, update the task planner itself
            const updatedPlanner = await prisma.taskPlanner.update({
                where: {
                    id: taskPlannerId
                },
                data: {
                    approvalStatus: approvalStatus,
                    updatedAt: new Date()
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });

            return {
                planner: updatedPlanner,
                updatedCounts: {
                    doctorTasks: updatedDoctorTasks.count,
                    chemistTasks: updatedChemistTasks.count,
                    tourPlanTasks: updatedTourPlanTasks.count,
                    total: updatedDoctorTasks.count + updatedChemistTasks.count + updatedTourPlanTasks.count
                }
            };
        });

        // Prepare success message based on status
        let successMessage = 'Task planner status updated successfully';
        if (approvalStatus === 'PENDING_APPROVAL') {
            successMessage = `Task planner and ${updatedData.updatedCounts.total} tasks submitted for approval successfully`;
        } else if (approvalStatus === 'APPROVED') {
            successMessage = `Task planner and ${updatedData.updatedCounts.total} tasks approved successfully`;
        } else if (approvalStatus === 'REJECTED') {
            successMessage = `Task planner and ${updatedData.updatedCounts.total} tasks rejected`;
        }

        return res.status(200).json({
            success: true,
            message: successMessage,
            data: {
                taskPlanner: updatedData.planner,
                updatedTasksCounts: updatedData.updatedCounts
            }
        });

    } catch (error) {
        console.error('Error occurred during task planner status update:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the task planner status',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};