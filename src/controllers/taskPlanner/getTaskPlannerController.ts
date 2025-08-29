import { Request, Response } from 'express';

export const getTaskPlannerController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const userId = req.user?.id;

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

        // Get current date (set to start of day for accurate comparison)
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        // Get all active task planners where endDate >= current date
        const taskPlanners = await tenantDb.taskPlanner.findMany({
            where: {
                isActive: true,
                endDate: {
                    gte: currentDate
                }
            },
            orderBy: {
                startDate: 'asc' // Order by start date ascending
            },
            include: {
                // Include all task details
                doctorTasks: {
                    where: {
                        isActive: true
                    },
                    orderBy: {
                        taskDate: 'asc'
                    },
                    select: {
                        id: true,
                        taskDate: true,
                        startTime: true,
                        endTime: true,
                        completionStatus: true,
                        approvalStatus: true,
                        doctor: {
                            select: {
                                id: true,
                                name: true,
                                specialization: true,
                                phone: true,
                                email: true,
                                hospitalAssociations: {
                                    select: {
                                        hospital: {
                                            select: {
                                                id: true,
                                                name: true,
                                                address: true,
                                                city: true,
                                                state: true,
                                                pincode: true
                                            }
                                        }
                                    },
                                    take: 1
                                }
                            }
                        }
                    }
                },
                chemistTasks: {
                    where: {
                        isActive: true
                    },
                    orderBy: {
                        taskDate: 'asc'
                    },
                    select: {
                        id: true,
                        taskDate: true,
                        startTime: true,
                        endTime: true,
                        completionStatus: true,
                        approvalStatus: true,
                        chemist: {
                            select: {
                                id: true,
                                name: true,
                                type: true,
                                address: true,
                                city: true,
                                state: true,
                                pincode: true,
                                phone: true,
                                email: true
                            }
                        }
                    }
                },
                tourPlanTasks: {
                    where: {
                        isActive: true
                    },
                    orderBy: {
                        taskDate: 'asc'
                    },
                    select: {
                        id: true,
                        taskDate: true,
                        startTime: true,
                        endTime: true,
                        location: true,
                        completionStatus: true,
                        approvalStatus: true,
                        tourPlan: {
                            select: {
                                id: true,
                                name: true,
                                description: true
                            }
                        }
                    }
                }
            }
        });

        // Format the response data
        const formattedPlanners = taskPlanners.map(planner => {
            // Calculate task statistics
            const doctorTaskCount = planner.doctorTasks?.length || 0;
            const chemistTaskCount = planner.chemistTasks?.length || 0;
            const tourPlanTaskCount = planner.tourPlanTasks?.length || 0;
            const totalTasks = doctorTaskCount + chemistTaskCount + tourPlanTaskCount;


            // Format dates and times for tasks
            const formatTaskDateTime = (task: any) => {
                return {
                    ...task,
                    taskDate: task.taskDate ? task.taskDate.toISOString().split('T')[0] : null,
                    startTime: task.startTime ? task.startTime.toISOString().substr(11, 5) : null,
                    endTime: task.endTime ? task.endTime.toISOString().substr(11, 5) : null,
                };
            };

            // Format all tasks with proper date/time formatting
            const formattedDoctorTasks = planner.doctorTasks?.map(task => ({
                ...formatTaskDateTime(task),
                type: 'DOCTOR',
                entityName: task.doctor?.name,
                entityDetails: task.doctor?.specialization,
                location: task.doctor?.hospitalAssociations?.[0]?.hospital
                    ? `${task.doctor.hospitalAssociations[0].hospital.name}, ${task.doctor.hospitalAssociations[0].hospital.city}`
                    : null
            }));

            const formattedChemistTasks = planner.chemistTasks?.map(task => ({
                ...formatTaskDateTime(task),
                type: 'CHEMIST',
                entityName: task.chemist?.name,
                entityDetails: task.chemist?.type,
                location: task.chemist
                    ? `${task.chemist.address || ''}, ${task.chemist.city || ''}`
                    : null
            }));

            const formattedTourPlanTasks = planner.tourPlanTasks?.map(task => ({
                ...formatTaskDateTime(task),
                type: 'TOUR_PLAN',
                entityName: task.tourPlan?.name,
                entityDetails: task.tourPlan?.description,
                location: task.location
            }));

            // Combine all tasks and sort by date and time
            const allTasks = [
                ...(formattedDoctorTasks || []),
                ...(formattedChemistTasks || []),
                ...(formattedTourPlanTasks || [])
            ].sort((a, b) => {
                const dateCompare = new Date(a.taskDate).getTime() - new Date(b.taskDate).getTime();
                if (dateCompare !== 0) return dateCompare;
                return a.startTime.localeCompare(b.startTime);
            });

            return {
                id: planner.id,
                startDate: planner.startDate.toISOString().split('T')[0],
                endDate: planner.endDate.toISOString().split('T')[0],
                approvalStatus: planner.approvalStatus,
                isActive: planner.isActive,
                createdAt: planner.createdAt,
                updatedAt: planner.updatedAt,
                statistics: {
                    totalTasks,
                    doctorTasks: doctorTaskCount,
                    chemistTasks: chemistTaskCount,
                    tourPlanTasks: tourPlanTaskCount,
                },
                tasks: {
                    doctorTasks: formattedDoctorTasks,
                    chemistTasks: formattedChemistTasks,
                    tourPlanTasks: formattedTourPlanTasks,
                    allTasks: allTasks
                }
            };
        });


        return res.status(200).json({
            success: true,
            message: 'Task planners retrieved successfully',
            data: {
                planners: formattedPlanners,
                currentDate: currentDate.toISOString().split('T')[0]
            }
        });

    } catch (error) {
        console.error('Error occurred while fetching task planners:', error);
        return res.status(500).json({
            success: false,
            message: 'Error occurred while fetching task planners',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};