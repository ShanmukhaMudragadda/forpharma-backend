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
 * GET /api/rcpa
 * List only RCPA reports created by the authenticated employee
 */
export const getRcpaList = async (req: AuthenticatedRequest, res: Response) => {
    try {
        console.log('📋 Getting RCPA reports for employee:', req.user?.employeeId);

        if (!req.tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
        }

        const rcpaReports = await req.tenantDb.rcpaReport.findMany({
            where: {
                employeeId: req.user?.employeeId
            },
            include: {
                chemist: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
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

        // Transform data to match frontend expectations
        const transformedReports = rcpaReports.map((report: any) => ({
            id: report.id,
            chemistName: report.chemist?.name || 'Unknown Chemist',
            chemistAddress: report.chemist?.address || '',
            observationDate: report.createdAt.toISOString().split('T')[0], // Format as YYYY-MM-DD
            totalPrescriptions: report.totalPrescription || 0,
            startDate: report.startDate,
            endDate: report.endDate,
            reportingPeriod: report.reportingPeriod
        }));

        res.status(200).json({
            success: true,
            message: `Retrieved ${transformedReports.length} RCPA reports for employee`,
            data: transformedReports
        });

    } catch (error) {
        console.error('❌ Error getting RCPA reports:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve RCPA reports',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};