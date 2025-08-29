import express from 'express'
import { Request, Response } from 'express';



export const createTaskController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const id = req.user?.id;
        const { taskPlannerId, type, type_id, date, startTime, endTime, location } = req.body;

        if (!id) {
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

        if (!taskPlannerId || !type || !type_id || !date || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'TaskPlannerId, TaskType, TaskType_id, date, startTime, endTime are required'
            });
        }

        const isTaskPlanner = await tenantDb.taskPlanner.findUnique({
            where: { id: taskPlannerId },
            select: {
                isActive: true
            }
        })

        if (!isTaskPlanner) {
            return res.status(400).json({
                success: false,
                message: 'Corresponding Task Planner either deleted or not exits'
            })
        }

        //  Parse dates and times properly
        // For DATE type - parse as full date
        const taskDate = new Date(date);

        // For TIME type - need to create a valid Date object with time
        // If startTime is "09:30:00", we need to create a full date-time
        // PostgreSQL TIME type will only store the time portion
        const taskStartTime = new Date(`1970-01-01T${startTime}`);
        const taskEndTime = new Date(`1970-01-01T${endTime}`);

        //  Validate dates
        if (isNaN(taskDate.getTime()) || isNaN(taskStartTime.getTime()) || isNaN(taskEndTime.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date or time format. Expected formats: date (YYYY-MM-DD), time (HH:MM:SS)'
            });
        }

        // Fix 6: Verify that the task planner exists
        const taskPlanner = await tenantDb?.taskPlanner.findUnique({
            where: { id: taskPlannerId }
        });

        if (!taskPlanner) {
            return res.status(404).json({
                success: false,
                message: 'Task planner not found'
            });
        }

        let task;

        if (type.toLowerCase() === 'doctor') {
            // Verify doctor exists
            const doctor = await tenantDb?.doctor.findUnique({
                where: { id: type_id }
            });

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            task = await tenantDb?.doctorTask.create({
                data: {
                    plannerId: taskPlannerId,
                    employeeId: id,
                    doctorId: type_id,
                    taskDate: taskDate,
                    startTime: taskStartTime,
                    endTime: taskEndTime
                }
            });
        }
        else if (type.toLowerCase() === 'chemist') {
            // Verify chemist exists
            const chemist = await tenantDb?.chemist.findUnique({
                where: { id: type_id }
            });

            if (!chemist) {
                return res.status(404).json({
                    success: false,
                    message: 'Chemist not found'
                });
            }

            task = await tenantDb?.chemistTask.create({
                data: {
                    plannerId: taskPlannerId,
                    employeeId: id,
                    chemistId: type_id,
                    taskDate: taskDate,
                    startTime: taskStartTime,
                    endTime: taskEndTime
                }
            });
        }
        else if (type.toLowerCase() === 'tourplan') {
            //  Location is required for TourPlanTask
            if (!location) {
                return res.status(400).json({
                    success: false,
                    message: 'Location is required for tour plan tasks'
                });
            }

            //  Verify tour plan exists
            const tourPlan = await tenantDb?.tourPlan.findUnique({
                where: { id: type_id }
            });

            if (!tourPlan) {
                return res.status(404).json({
                    success: false,
                    message: 'Tour plan not found'
                });
            }

            task = await tenantDb?.tourPlanTask.create({
                data: {
                    plannerId: taskPlannerId,
                    employeeId: id,
                    tourPlanId: type_id,
                    location: location,
                    taskDate: taskDate,
                    startTime: taskStartTime,
                    endTime: taskEndTime
                }
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: task
        });

    } catch (error) {
        //  Added proper error handling
        console.error('Error creating task:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while creating the task',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};