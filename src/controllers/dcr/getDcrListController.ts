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

interface DCRListItem {
    dcrId: string;
    customerName: string;
    date: string;
    timings: string;
    status: string;
}

/**
 * GET /api/dcr
 * List DCR reports for authenticated employee
 */
export const getDcrList = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        console.log('📋 Getting DCR reports for employee:', req.user?.employeeId);

        if (!req.tenantDb) {
            res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
            return;
        }

        // Get search and filter parameters
        const { search, dateRange, customStartDate, customEndDate } = req.query;

        // Build where clause for DCR reports
        let whereClause: any = {
            employeeId: req.user?.employeeId
        };

        // Apply date filter if provided
        if (dateRange || (customStartDate && customEndDate)) {
            const today = new Date();
            let startDate: Date | undefined;
            let endDate: Date = today;

            if (dateRange) {
                switch (dateRange) {
                    case 'lastWeek':
                        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'lastMonth':
                        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    case 'last3Months':
                        startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                        break;
                    case 'last6Months':
                        startDate = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
                        break;
                    case 'lastYear':
                        startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
                        break;
                    default:
                        startDate = new Date(0);
                }
            } else if (customStartDate && customEndDate) {
                startDate = new Date(customStartDate as string);
                endDate = new Date(customEndDate as string);
            }

            if (startDate) {
                whereClause.createdAt = {
                    gte: startDate,
                    lte: endDate
                };
            }
        }

        // Get DCR reports
        const dcrReports = await req.tenantDb.dcrReport.findMany({
            where: whereClause,
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Transform DCR reports to include task details
        const transformedDCRs: DCRListItem[] = [];

        for (const dcr of dcrReports) {
            let customerName = 'Unknown';
            let timings = 'Not specified';

            try {
                // Determine task type and get details
                if (dcr.taskType === 'DOCTOR_TASK' && dcr.taskId) {
                    const doctorTask = await req.tenantDb.doctorTask.findUnique({
                        where: { id: dcr.taskId },
                        include: {
                            doctor: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    });

                    if (doctorTask) {
                        customerName = doctorTask.doctor?.name || 'Unknown Doctor';
                        // Format time from database time fields (TIME type)
                        const startTimeStr = doctorTask.startTime.toISOString().substr(11, 5);
                        const endTimeStr = doctorTask.endTime.toISOString().substr(11, 5);

                        // Convert to 12-hour format
                        const formatTime = (timeStr: string): string => {
                            const [hours, minutes] = timeStr.split(':');
                            const hour = parseInt(hours);
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                            return `${displayHour}:${minutes} ${ampm}`;
                        };

                        timings = `${formatTime(startTimeStr)} - ${formatTime(endTimeStr)}`;
                    }
                } else if (dcr.taskType === 'CHEMIST_TASK' && dcr.taskId) {
                    const chemistTask = await req.tenantDb.chemistTask.findUnique({
                        where: { id: dcr.taskId },
                        include: {
                            chemist: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    });

                    if (chemistTask) {
                        customerName = chemistTask.chemist?.name || 'Unknown Chemist';
                        // Format time from database time fields (TIME type)
                        const startTimeStr = chemistTask.startTime.toISOString().substr(11, 5);
                        const endTimeStr = chemistTask.endTime.toISOString().substr(11, 5);

                        // Convert to 12-hour format
                        const formatTime = (timeStr: string): string => {
                            const [hours, minutes] = timeStr.split(':');
                            const hour = parseInt(hours);
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                            return `${displayHour}:${minutes} ${ampm}`;
                        };

                        timings = `${formatTime(startTimeStr)} - ${formatTime(endTimeStr)}`;
                    }
                } else if (dcr.taskType === 'TOUR_PLAN_TASK' && dcr.taskId) {
                    const tourPlanTask = await req.tenantDb.tourPlanTask.findUnique({
                        where: { id: dcr.taskId },
                        select: {
                            location: true,
                            startTime: true,
                            endTime: true,
                            tourPlan: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    });

                    if (tourPlanTask) {
                        customerName = tourPlanTask.tourPlan?.name || tourPlanTask.location || 'Tour Plan';
                        // Format time from database time fields (TIME type)
                        const startTimeStr = tourPlanTask.startTime.toISOString().substr(11, 5);
                        const endTimeStr = tourPlanTask.endTime.toISOString().substr(11, 5);

                        // Convert to 12-hour format
                        const formatTime = (timeStr: string): string => {
                            const [hours, minutes] = timeStr.split(':');
                            const hour = parseInt(hours);
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                            return `${displayHour}:${minutes} ${ampm}`;
                        };

                        timings = `${formatTime(startTimeStr)} - ${formatTime(endTimeStr)}`;
                    }
                }
            } catch (taskError) {
                console.warn('Error fetching task details for DCR:', dcr.id, taskError);
                // Continue with default values
            }

            const transformedDCR: DCRListItem = {
                dcrId: dcr.id,
                customerName: customerName,
                date: dcr.createdAt.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit'
                }),
                timings: timings,
                status: dcr.isDraft ? 'draft' : 'completed'
            };

            // Apply search filter on backend if provided
            if (search) {
                const searchTerm = (search as string).toLowerCase();
                const matchesSearch = transformedDCR.dcrId.toLowerCase().includes(searchTerm) ||
                    transformedDCR.customerName.toLowerCase().includes(searchTerm);

                if (matchesSearch) {
                    transformedDCRs.push(transformedDCR);
                }
            } else {
                transformedDCRs.push(transformedDCR);
            }
        }

        res.status(200).json({
            success: true,
            message: `Retrieved ${transformedDCRs.length} DCR reports`,
            data: transformedDCRs
        });

    } catch (error) {
        console.error('❌ Error getting DCR reports:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve DCR reports',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};