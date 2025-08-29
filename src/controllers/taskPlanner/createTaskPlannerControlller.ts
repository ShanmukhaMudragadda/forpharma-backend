import express from 'express'
import { Request, Response } from 'express'


export const createTaskPlannerController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const id = req.user?.id;

        const { startDate, endDate } = req.body;

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

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'startDate and endDate are required'
            })
        }


        const plannerStartDate = new Date(startDate);
        const plannerEndDate = new Date(endDate);

        if (isNaN(plannerStartDate.getTime()) || isNaN(plannerEndDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date or time format. Expected formats: date (YYYY-MM-DD), time (HH:MM:SS)'
            })
        }

        const taskPlanner = await tenantDb.taskPlanner.create({
            data: {
                employeeId: id,
                startDate: plannerStartDate,
                endDate: plannerEndDate
            }
        })

        return res.status(200).json({
            success: true,
            message: 'Task Planner created successfully',
            taskPlanner
        })

    } catch (error) {
        console.log('error occured during task planner creation:', error);
        return res.status(500).json({
            success: false,
            message: 'error occured during task planner creation',
            error
        })

    }
}