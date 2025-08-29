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

/**
 * GET /api/dcr/:dcrId
 * Get detailed information about a specific DCR report
 */
export const getDcrDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { dcrId } = req.params;
        console.log('🔍 Getting DCR details for:', dcrId);

        if (!req.tenantDb) {
            res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
            return;
        }

        const dcr = await req.tenantDb.dcrReport.findFirst({
            where: {
                id: dcrId,
                employeeId: req.user?.employeeId // Ensure user can only access their own DCR
            },
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        if (!dcr) {
            res.status(404).json({
                success: false,
                message: 'DCR report not found or you do not have permission to view this report'
            });
            return;
        }

        // Get task-specific details - FIXED: Separate the include and select properly
        let taskDetails = null;
        if (dcr.taskType && dcr.taskId) {
            try {
                if (dcr.taskType === 'DOCTOR_TASK') {
                    taskDetails = await req.tenantDb.doctorTask.findUnique({
                        where: { id: dcr.taskId },
                        select: {
                            taskDate: true,
                            startTime: true,
                            endTime: true,
                            doctor: {
                                select: {
                                    name: true,
                                    specialization: true,
                                    phone: true,
                                    email: true,
                                    hospitalAssociations: {
                                        where: {
                                            isPrimary: true
                                        },
                                        select: {
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
                } else if (dcr.taskType === 'CHEMIST_TASK') {
                    taskDetails = await req.tenantDb.chemistTask.findUnique({
                        where: { id: dcr.taskId },
                        select: {
                            taskDate: true,
                            startTime: true,
                            endTime: true,
                            chemist: {
                                select: {
                                    name: true,
                                    type: true,
                                    phone: true,
                                    email: true,
                                    address: true,
                                    city: true,
                                    state: true
                                }
                            }
                        }
                    });
                } else if (dcr.taskType === 'TOUR_PLAN_TASK') {
                    taskDetails = await req.tenantDb.tourPlanTask.findUnique({
                        where: { id: dcr.taskId },
                        select: {
                            taskDate: true,
                            startTime: true,
                            endTime: true,
                            location: true,
                            tourPlan: {
                                select: {
                                    name: true,
                                    description: true
                                }
                            }
                        }
                    });
                }
            } catch (taskError) {
                console.warn('Error fetching task details:', taskError);
            }
        }

        // Transform DCR details for frontend
        const dcrDetails = {
            dcrId: dcr.id,
            reportDate: dcr.reportDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            status: dcr.isDraft ? 'draft' : 'completed',
            productsDiscussed: dcr.productsDiscussed || '',
            comments: dcr.comments || '',

            // Employee information
            createdBy: {
                name: `${dcr.employee?.firstName || ''} ${dcr.employee?.lastName || ''}`.trim() || 'Unknown Employee',
                email: dcr.employee?.email
            },

            // Task information
            taskType: dcr.taskType,
            taskId: dcr.taskId,
            taskDetails: taskDetails,

            // Timestamps
            createdAt: dcr.createdAt,
            updatedAt: dcr.updatedAt
        };

        res.status(200).json({
            success: true,
            message: 'DCR details retrieved successfully',
            data: dcrDetails
        });

    } catch (error) {
        console.error('❌ Error getting DCR details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve DCR details',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};