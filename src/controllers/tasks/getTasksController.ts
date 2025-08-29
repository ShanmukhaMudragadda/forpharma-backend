import express from 'express'
import { Request, Response } from 'express';

interface DailyTask {
    id: string;
    type: 'doctor' | 'chemist' | 'tourplan';
    typeId: string;
    name: string;
    details?: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
    completionStatus: string;
    approvalStatus: string;
    plannerId: string;
}

/**
 * GET /api/tasks/daily/:date
 * Get all tasks for a specific date
 * @param date - Date in YYYY-MM-DD format
 */
export const getTasksController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const userId = req.user?.id;
        const { date } = req.params;

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

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date parameter is required'
            });
        }

        // Parse the date
        const taskDate = new Date(date);

        // Format time helper function
        const formatTime = (timeDate: Date): string => {
            const timeStr = timeDate.toISOString().substr(11, 5);
            const [hours, minutes] = timeStr.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            return `${displayHour}:${minutes} ${ampm}`;
        };

        const dailyTasks: DailyTask[] = [];

        // Fetch Doctor Tasks for the date
        const doctorTasks = await tenantDb.doctorTask.findMany({
            where: {
                employeeId: userId,
                taskDate: taskDate,
                isActive: true
            },
            include: {
                doctor: {
                    select: {
                        name: true,
                        specialization: true,
                        hospitalAssociations: {
                            where: {
                                isPrimary: true
                            },
                            include: {
                                hospital: {
                                    select: {
                                        name: true,
                                        address: true,
                                        city: true,
                                        state: true
                                    }
                                }
                            },
                            take: 1
                        }
                    }
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        });

        // Process doctor tasks
        for (const task of doctorTasks) {
            const hospital = task.doctor?.hospitalAssociations?.[0]?.hospital;
            const location = hospital
                ? `${hospital.name}, ${hospital.address || ''}, ${hospital.city || ''}, ${hospital.state || ''}`
                    .replace(/, ,/g, ',')
                    .replace(/^, |, $/, '')
                    .trim()
                : 'Apollo,Gowlidoddy,Hyderabad ,Telangana';

            dailyTasks.push({
                id: task.id,
                type: 'doctor',
                typeId: task.doctorId,
                name: task.doctor?.name || 'Doctor',
                details: task.doctor?.specialization || undefined,
                date: task.taskDate.toISOString().split('T')[0],
                startTime: formatTime(task.startTime),
                endTime: formatTime(task.endTime),
                location: location,
                completionStatus: task.completionStatus,
                approvalStatus: task.approvalStatus,
                plannerId: task.plannerId
            });
        }

        // Fetch Chemist Tasks for the date
        const chemistTasks = await tenantDb.chemistTask.findMany({
            where: {
                taskDate: taskDate,
                isActive: true
            },
            include: {
                chemist: {
                    select: {
                        name: true,
                        address: true,
                        city: true,
                        state: true
                    }
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        });

        // Process chemist tasks
        for (const task of chemistTasks) {
            const location = task.chemist
                ? `${task.chemist.address || ''}, ${task.chemist.city || ''}, ${task.chemist.state || ''}`
                    .replace(/^, |, ,|,$/, '')
                    .replace(/^,/, '')
                    .trim()
                : 'Gowlidoddy,Hyderabad ,Telangana';

            dailyTasks.push({
                id: task.id,
                type: 'chemist',
                typeId: task.chemistId,
                name: task.chemist?.name || 'Chemist',
                date: task.taskDate.toISOString().split('T')[0],
                startTime: formatTime(task.startTime),
                endTime: formatTime(task.endTime),
                location: location || 'Gowlidoddy,Hyderabad,Telangana',
                completionStatus: task.completionStatus,
                approvalStatus: task.approvalStatus,
                plannerId: task.plannerId
            });
        }

        // Fetch Tour Plan Tasks for the date
        const tourPlanTasks = await tenantDb.tourPlanTask.findMany({
            where: {
                taskDate: taskDate,
                isActive: true
            },
            include: {
                tourPlan: {
                    select: {
                        name: true,
                        description: true
                    }
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        });

        // Process tour plan tasks
        for (const task of tourPlanTasks) {
            dailyTasks.push({
                id: task.id,
                type: 'tourplan',
                typeId: task.tourPlanId,
                name: task.tourPlan?.name || 'Tour Plan',
                details: task.tourPlan?.description || undefined,
                date: task.taskDate.toISOString().split('T')[0],
                startTime: formatTime(task.startTime),
                endTime: formatTime(task.endTime),
                location: task.location || 'Gowlidoddy,Hyderabad ,Telangana',
                completionStatus: task.completionStatus,
                approvalStatus: task.approvalStatus,
                plannerId: task.plannerId
            });
        }

        // Sort all tasks by start time
        dailyTasks.sort((a, b) => {
            const timeA = parseInt(a.startTime.split(':')[0]) + (a.startTime.includes('PM') ? 12 : 0);
            const timeB = parseInt(b.startTime.split(':')[0]) + (b.startTime.includes('PM') ? 12 : 0);
            return timeA - timeB;
        });

        // Get task counts by type
        const taskCounts = {
            total: dailyTasks.length,
            doctors: dailyTasks.filter(t => t.type === 'doctor').length,
            chemists: dailyTasks.filter(t => t.type === 'chemist').length,
            tourPlans: dailyTasks.filter(t => t.type === 'tourplan').length
        };

        // Get task counts by status
        const statusCounts = {
            pending: dailyTasks.filter(t => t.completionStatus === 'PENDING').length,
            completed: dailyTasks.filter(t => t.completionStatus === 'COMPLETED').length,
            rescheduled: dailyTasks.filter(t => t.completionStatus === 'RESCHEDULED').length,
            cancelled: dailyTasks.filter(t => t.completionStatus === 'CANCELLED').length
        };

        return res.status(200).json({
            success: true,
            message: 'Daily tasks retrieved successfully',
            data: {
                date: date,
                tasks: dailyTasks,
                summary: {
                    counts: taskCounts,
                    statusCounts: statusCounts
                }
            }
        });

    } catch (error) {
        console.error('Error fetching daily tasks:', error);
        return res.status(500).json({
            success: false,
            message: 'Error occurred while fetching daily tasks',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getTasksOfPlannerController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const userId = req.user?.id;
        const { plannerId } = req.params;

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

        if (!plannerId) {
            return res.status(400).json({
                success: false,
                message: 'Date parameter is required'
            });
        }

        // Format time helper function
        const formatTime = (timeDate: Date): string => {
            const timeStr = timeDate.toISOString().substr(11, 5);
            const [hours, minutes] = timeStr.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            return `${displayHour}:${minutes} ${ampm}`;
        };

        const dailyTasks: DailyTask[] = [];

        // Fetch Doctor Tasks for the date
        const doctorTasks = await tenantDb.doctorTask.findMany({
            where: {
                plannerId: plannerId,
                isActive: true
            },
            include: {
                doctor: {
                    select: {
                        name: true,
                        specialization: true,
                        hospitalAssociations: {
                            where: {
                                isPrimary: true
                            },
                            include: {
                                hospital: {
                                    select: {
                                        name: true,
                                        address: true,
                                        city: true,
                                        state: true
                                    }
                                }
                            },
                            take: 1
                        }
                    }
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        });

        // Process doctor tasks
        for (const task of doctorTasks) {
            const hospital = task.doctor?.hospitalAssociations?.[0]?.hospital;
            const location = hospital
                ? `${hospital.name}, ${hospital.address || ''}, ${hospital.city || ''}, ${hospital.state || ''}`
                    .replace(/, ,/g, ',')
                    .replace(/^, |, $/, '')
                    .trim()
                : 'Apollo,Gowlidoddy,Hyderabad ,Telangana';

            dailyTasks.push({
                id: task.id,
                type: 'doctor',
                typeId: task.doctorId,
                name: task.doctor?.name || 'Doctor',
                details: task.doctor?.specialization || undefined,
                date: task.taskDate.toISOString().split('T')[0],
                startTime: formatTime(task.startTime),
                endTime: formatTime(task.endTime),
                location: location,
                completionStatus: task.completionStatus,
                approvalStatus: task.approvalStatus,
                plannerId: task.plannerId
            });
        }

        // Fetch Chemist Tasks for the date
        const chemistTasks = await tenantDb.chemistTask.findMany({
            where: {
                plannerId: plannerId,
                isActive: true
            },
            include: {
                chemist: {
                    select: {
                        name: true,
                        address: true,
                        city: true,
                        state: true
                    }
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        });

        // Process chemist tasks
        for (const task of chemistTasks) {
            const location = task.chemist
                ? `${task.chemist.address || ''}, ${task.chemist.city || ''}, ${task.chemist.state || ''}`
                    .replace(/^, |, ,|,$/, '')
                    .replace(/^,/, '')
                    .trim()
                : 'Gowlidoddy,Hyderabad ,Telangana';

            dailyTasks.push({
                id: task.id,
                type: 'chemist',
                typeId: task.chemistId,
                name: task.chemist?.name || 'Chemist',
                date: task.taskDate.toISOString().split('T')[0],
                startTime: formatTime(task.startTime),
                endTime: formatTime(task.endTime),
                location: location || 'Gowlidoddy,Hyderabad,Telangana',
                completionStatus: task.completionStatus,
                approvalStatus: task.approvalStatus,
                plannerId: task.plannerId
            });
        }

        // Fetch Tour Plan Tasks for the date
        const tourPlanTasks = await tenantDb.tourPlanTask.findMany({
            where: {
                plannerId: plannerId,
                isActive: true
            },
            include: {
                tourPlan: {
                    select: {
                        name: true,
                        description: true
                    }
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        });

        // Process tour plan tasks
        for (const task of tourPlanTasks) {
            dailyTasks.push({
                id: task.id,
                type: 'tourplan',
                typeId: task.tourPlanId,
                name: task.tourPlan?.name || 'Tour Plan',
                details: task.tourPlan?.description || undefined,
                date: task.taskDate.toISOString().split('T')[0],
                startTime: formatTime(task.startTime),
                endTime: formatTime(task.endTime),
                location: task.location || 'Gowlidoddy,Hyderabad ,Telangana',
                completionStatus: task.completionStatus,
                approvalStatus: task.approvalStatus,
                plannerId: task.plannerId
            });
        }

        // Sort all tasks by start time
        dailyTasks.sort((a, b) => {
            const timeA = parseInt(a.startTime.split(':')[0]) + (a.startTime.includes('PM') ? 12 : 0);
            const timeB = parseInt(b.startTime.split(':')[0]) + (b.startTime.includes('PM') ? 12 : 0);
            return timeA - timeB;
        });

        // Get task counts by type
        const taskCounts = {
            total: dailyTasks.length,
            doctors: dailyTasks.filter(t => t.type === 'doctor').length,
            chemists: dailyTasks.filter(t => t.type === 'chemist').length,
            tourPlans: dailyTasks.filter(t => t.type === 'tourplan').length
        };

        // Get task counts by status
        const statusCounts = {
            pending: dailyTasks.filter(t => t.completionStatus === 'PENDING').length,
            completed: dailyTasks.filter(t => t.completionStatus === 'COMPLETED').length,
            rescheduled: dailyTasks.filter(t => t.completionStatus === 'RESCHEDULED').length,
            cancelled: dailyTasks.filter(t => t.completionStatus === 'CANCELLED').length
        };

        return res.status(200).json({
            success: true,
            message: 'Daily tasks retrieved successfully',
            data: {
                tasks: dailyTasks,
                summary: {
                    counts: taskCounts,
                    statusCounts: statusCounts
                }
            }
        });

    } catch (error) {
        console.error('Error fetching daily tasks:', error);
        return res.status(500).json({
            success: false,
            message: 'Error occurred while fetching daily tasks',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};