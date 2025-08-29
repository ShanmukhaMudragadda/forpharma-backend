// @ts-nocheck
import { Request, Response } from 'express';

// Extended Request interface to include tenant database and user info
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        employeeId: string;
        organizationId: string;
        email: string;
        role: string;
    };
    tenantDb?: any; // Prisma tenant client
}

interface TaskDetail {
    taskId: string;
    taskType: string;
    name: string;
    date: string;
    address: string;
    timings: string;
}

/**
 * GET /api/dcr/tasks/available
 * Get available tasks for DCR creation (COMPLETED and RESCHEDULED tasks)
 */
export const getTasksForDcr = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        console.log('📋 Getting available tasks for DCR creation:', req.user?.employeeId);

        if (!req.tenantDb) {
            res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
            return;
        }

        const availableTasks: TaskDetail[] = [];

        // Get existing DCR task IDs to exclude tasks that already have DCR reports
        const existingDCRs = await req.tenantDb.dcrReport.findMany({
            where: {
                employeeId: req.user?.employeeId
            },
            select: {
                taskId: true,
                taskType: true
            }
        });

        const existingDCRTaskIds = {
            DOCTOR_TASK: existingDCRs.filter(dcr => dcr.taskType === 'DOCTOR_TASK').map(dcr => dcr.taskId),
            CHEMIST_TASK: existingDCRs.filter(dcr => dcr.taskType === 'CHEMIST_TASK').map(dcr => dcr.taskId),
            TOUR_PLAN_TASK: existingDCRs.filter(dcr => dcr.taskType === 'TOUR_PLAN_TASK').map(dcr => dcr.taskId)
        };

        // Format time helper function
        const formatTime = (timeStr: string): string => {
            const [hours, minutes] = timeStr.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            return `${displayHour}:${minutes} ${ampm}`;
        };

        // Get Doctor Tasks (COMPLETED and RESCHEDULED status, without existing DCR)
        const doctorTasks = await req.tenantDb.doctorTask.findMany({
            where: {
                employeeId: req.user?.employeeId,
                completionStatus: {
                    in: ['COMPLETED', 'RESCHEDULED']
                },
                ...(existingDCRTaskIds.DOCTOR_TASK.length > 0 ? {
                    id: {
                        notIn: existingDCRTaskIds.DOCTOR_TASK
                    }
                } : {})
            },
            orderBy: {
                taskDate: 'desc'
            },
            include: {
                doctor: {
                    include: {
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
            }
        });

        for (const task of doctorTasks) {
            const hospital = task.doctor?.hospitalAssociations?.[0]?.hospital;
            const address = hospital
                ? `${hospital.name}, ${hospital.address}, ${hospital.city || ''}, ${hospital.state || ''}`.replace(/, ,/g, ',').replace(/,$/, '')
                : 'Hospital address not available';

            // Format time from database time fields (TIME type)
            const startTimeStr = task.startTime.toISOString().substr(11, 5);
            const endTimeStr = task.endTime.toISOString().substr(11, 5);

            availableTasks.push({
                taskId: task.id,
                taskType: 'DOCTOR_TASK',
                name: task.doctor?.name || 'Unknown Doctor',
                date: task.taskDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }),
                address: address,
                timings: `${formatTime(startTimeStr)} - ${formatTime(endTimeStr)}`
            });
        }

        // Get Chemist Tasks (COMPLETED and RESCHEDULED status, without existing DCR)
        const chemistTasks = await req.tenantDb.chemistTask.findMany({
            where: {
                employeeId: req.user?.employeeId,
                completionStatus: {
                    in: ['COMPLETED', 'RESCHEDULED']
                },
                ...(existingDCRTaskIds.CHEMIST_TASK.length > 0 ? {
                    id: {
                        notIn: existingDCRTaskIds.CHEMIST_TASK
                    }
                } : {})
            },
            orderBy: {
                taskDate: 'desc'
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
            }
        });

        for (const task of chemistTasks) {
            const address = task.chemist
                ? `${task.chemist.address || ''}, ${task.chemist.city || ''}, ${task.chemist.state || ''}`.replace(/^, |, ,|,$/, '').replace(/^,/, '') || 'Address not available'
                : 'Chemist address not available';

            // Format time from database time fields (TIME type)
            const startTimeStr = task.startTime.toISOString().substr(11, 5);
            const endTimeStr = task.endTime.toISOString().substr(11, 5);

            availableTasks.push({
                taskId: task.id,
                taskType: 'CHEMIST_TASK',
                name: task.chemist?.name || 'Unknown Chemist',
                date: task.taskDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }),
                address: address,
                timings: `${formatTime(startTimeStr)} - ${formatTime(endTimeStr)}`
            });
        }

        // Get Tour Plan Tasks (COMPLETED and RESCHEDULED status, without existing DCR)
        const tourPlanTasks = await req.tenantDb.tourPlanTask.findMany({
            where: {
                employeeId: req.user?.employeeId,
                completionStatus: {
                    in: ['COMPLETED', 'RESCHEDULED']
                },
                ...(existingDCRTaskIds.TOUR_PLAN_TASK.length > 0 ? {
                    id: {
                        notIn: existingDCRTaskIds.TOUR_PLAN_TASK
                    }
                } : {})
            },
            orderBy: {
                taskDate: 'desc'
            },
            include: {
                tourPlan: {
                    select: {
                        name: true,
                        description: true
                    }
                }
            }
        });

        for (const task of tourPlanTasks) {
            // Format time from database time fields (TIME type)
            const startTimeStr = task.startTime.toISOString().substr(11, 5);
            const endTimeStr = task.endTime.toISOString().substr(11, 5);

            availableTasks.push({
                taskId: task.id,
                taskType: 'TOUR_PLAN_TASK',
                name: task.tourPlan?.name || 'Tour Plan',
                date: task.taskDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }),
                address: task.location || 'Location not specified',
                timings: `${formatTime(startTimeStr)} - ${formatTime(endTimeStr)}`
            });
        }

        // Sort all tasks by date (most recent first)
        availableTasks.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB.getTime() - dateA.getTime();
        });

        console.log(`Found ${availableTasks.length} available tasks for DCR creation`);

        res.status(200).json({
            success: true,
            message: `Retrieved ${availableTasks.length} available tasks`,
            data: availableTasks
        });

    } catch (error) {
        console.error('❌ Error getting tasks for DCR:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve tasks',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

/**
 * POST /api/dcr
 * Create a new DCR report
 */
export const createDcr = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const dcrData = req.body;
        console.log('📝 Creating new DCR for employee:', req.user?.employeeId);

        if (!req.tenantDb) {
            res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
            return;
        }

        // Validate required fields
        if (!dcrData.taskId || !dcrData.taskType) {
            res.status(400).json({
                success: false,
                message: 'Task ID and Task Type are required'
            });
            return;
        }

        // Validate that at least one field is filled
        if (!dcrData.productsDiscussed?.trim() && !dcrData.comments?.trim()) {
            res.status(400).json({
                success: false,
                message: 'Either Products Discussed or Comments must be provided'
            });
            return;
        }

        // Get task date based on task type
        let taskDate: Date | undefined;
        let taskExists = false;

        if (dcrData.taskType === 'DOCTOR_TASK') {
            const task = await req.tenantDb.doctorTask.findFirst({
                where: {
                    id: dcrData.taskId,
                    employeeId: req.user?.employeeId
                }
            });
            if (task) {
                taskDate = task.taskDate;
                taskExists = true;
            }
        } else if (dcrData.taskType === 'CHEMIST_TASK') {
            const task = await req.tenantDb.chemistTask.findFirst({
                where: {
                    id: dcrData.taskId,
                    employeeId: req.user?.employeeId
                }
            });
            if (task) {
                taskDate = task.taskDate;
                taskExists = true;
            }
        } else if (dcrData.taskType === 'TOUR_PLAN_TASK') {
            const task = await req.tenantDb.tourPlanTask.findFirst({
                where: {
                    id: dcrData.taskId,
                    employeeId: req.user?.employeeId
                }
            });
            if (task) {
                taskDate = task.taskDate;
                taskExists = true;
            }
        }

        if (!taskExists || !taskDate) {
            res.status(404).json({
                success: false,
                message: 'Task not found or you do not have permission to create DCR for this task'
            });
            return;
        }

        // Check if DCR already exists for this task
        const existingDCR = await req.tenantDb.dcrReport.findFirst({
            where: {
                taskId: dcrData.taskId,
                taskType: dcrData.taskType,
                employeeId: req.user?.employeeId
            }
        });

        if (existingDCR) {
            res.status(409).json({
                success: false,
                message: 'DCR already exists for this task. Please edit the existing DCR instead.'
            });
            return;
        }

        // Create DCR report
        const dcrReport = await req.tenantDb.dcrReport.create({
            data: {
                organizationId: req.user?.organizationId,
                employeeId: req.user?.employeeId,
                taskId: dcrData.taskId,
                taskType: dcrData.taskType,
                reportDate: taskDate,
                productsDiscussed: dcrData.productsDiscussed?.trim() || null,
                comments: dcrData.comments?.trim() || null,
                isDraft: dcrData.isDraft === true
            }
        });

        res.status(201).json({
            success: true,
            message: `DCR ${dcrData.isDraft ? 'saved as draft' : 'submitted'} successfully`,
            data: {
                dcrId: dcrReport.id,
                status: dcrReport.isDraft ? 'draft' : 'completed',
                reportDate: dcrReport.reportDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
            }
        });

    } catch (error) {
        console.error('❌ Error creating DCR:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create DCR report',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};