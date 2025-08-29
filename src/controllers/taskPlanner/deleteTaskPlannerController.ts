import express from 'express'
import { Request, Response } from 'express'

export const deleteTaskPlannerController = async (req: Request, res: Response) => {
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

        if (!taskPlannerId) {
            return res.status(400).json({
                success: false,
                message: 'Task planner ID is required'
            });
        }

        // Check if task planner exists and is active
        const taskPlanner = await tenantDb.taskPlanner.findFirst({
            where: {
                id: taskPlannerId,
                isActive: true  // Only find active planners
            },
            select: {
                id: true,
                employeeId: true,
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
                message: 'Task planner not found or already deleted'
            });
        }

        // Verify ownership
        if (taskPlanner.employeeId !== user_id) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this task planner'
            });
        }

        // Calculate total active tasks that will be soft deleted
        const totalTasksToDelete =
            taskPlanner._count.doctorTasks +
            taskPlanner._count.chemistTasks +
            taskPlanner._count.tourPlanTasks;

        // Use a transaction to soft delete everything
        const deletedData = await tenantDb.$transaction(async (prisma) => {

            // Soft delete all associated doctor tasks
            const updatedDoctorTasks = await prisma.doctorTask.updateMany({
                where: {
                    plannerId: taskPlannerId,
                    isActive: true
                },
                data: {
                    isActive: false,
                }
            });

            // Soft delete all associated chemist tasks
            const updatedChemistTasks = await prisma.chemistTask.updateMany({
                where: {
                    plannerId: taskPlannerId,
                    isActive: true
                },
                data: {
                    isActive: false,
                }
            });

            // Soft delete all associated tour plan tasks
            const updatedTourPlanTasks = await prisma.tourPlanTask.updateMany({
                where: {
                    plannerId: taskPlannerId,
                    isActive: true
                },
                data: {
                    isActive: false,
                }
            });

            // Finally, soft delete the task planner
            const updatedPlanner = await prisma.taskPlanner.update({
                where: {
                    id: taskPlannerId
                },
                data: {
                    isActive: false,
                }
            });

            return {
                planner: updatedPlanner,
                deletedCounts: {
                    doctorTasks: updatedDoctorTasks.count,
                    chemistTasks: updatedChemistTasks.count,
                    tourPlanTasks: updatedTourPlanTasks.count,
                    total: updatedDoctorTasks.count + updatedChemistTasks.count + updatedTourPlanTasks.count
                }
            };
        });

        return res.status(200).json({
            success: true,
            message: `Task planner and ${totalTasksToDelete} associated tasks deleted successfully`,
            data: {
                deletedPlanner: deletedData.planner,
                deletedTasksCount: deletedData.deletedCounts
            }
        });

    } catch (error) {
        console.error('Error occurred during task planner deletion:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the task planner',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};