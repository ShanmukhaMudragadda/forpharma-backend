import express from 'express'
import { Request, Response } from 'express';


export const deleteTaskController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const user_id = req.user?.id;
        const { task_id, type } = req.params; // Expecting /api/tasks/:type/:task_id

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

        let deletedTask;

        if (type.toLowerCase() === 'doctor') {
            // Check if doctor task exists and is active
            const doctorTask = await tenantDb.doctorTask.findFirst({
                where: {
                    id: task_id,
                    isActive: true
                },
                select: {
                    id: true,
                    employeeId: true,
                    plannerId: true,
                    doctorId: true,
                    taskDate: true
                }
            });

            if (!doctorTask) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor task not found or already deleted'
                });
            }

            // Verify ownership
            if (doctorTask.employeeId !== user_id) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to delete this task'
                });
            }

            // Soft delete the doctor task
            deletedTask = await tenantDb.doctorTask.update({
                where: {
                    id: task_id
                },
                data: {
                    isActive: false
                }
            });

        } else if (type.toLowerCase() === 'chemist') {
            // Check if chemist task exists and is active
            const chemistTask = await tenantDb.chemistTask.findFirst({
                where: {
                    id: task_id,
                    isActive: true
                },
                select: {
                    id: true,
                    employeeId: true,
                    plannerId: true,
                    chemistId: true,
                    taskDate: true
                }
            });

            if (!chemistTask) {
                return res.status(404).json({
                    success: false,
                    message: 'Chemist task not found or already deleted'
                });
            }

            // Verify ownership
            if (chemistTask.employeeId !== user_id) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to delete this task'
                });
            }

            // Soft delete the chemist task
            deletedTask = await tenantDb.chemistTask.update({
                where: {
                    id: task_id
                },
                data: {
                    isActive: false
                }
            });

        } else if (type.toLowerCase() === 'tourplan') {
            // Check if tour plan task exists and is active
            const tourPlanTask = await tenantDb.tourPlanTask.findFirst({
                where: {
                    id: task_id,
                    isActive: true
                },
                select: {
                    id: true,
                    employeeId: true,
                    plannerId: true,
                    tourPlanId: true,
                    taskDate: true,
                    location: true
                }
            });

            if (!tourPlanTask) {
                return res.status(404).json({
                    success: false,
                    message: 'Tour plan task not found or already deleted'
                });
            }

            // Verify ownership
            if (tourPlanTask.employeeId !== user_id) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to delete this task'
                });
            }

            // Soft delete the tour plan task
            deletedTask = await tenantDb.tourPlanTask.update({
                where: {
                    id: task_id
                },
                data: {
                    isActive: false
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: `${type.charAt(0).toUpperCase() + type.slice(1)} task deleted successfully`,
            data: deletedTask
        });

    } catch (error) {
        console.error('Error occurred during task deletion:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the task',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};