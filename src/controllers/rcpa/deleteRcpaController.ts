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
 * DELETE /api/rcpa/:rcpaId
 * Delete RCPA report and its drug data
 */
export const deleteRcpa = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { rcpaId } = req.params;
        console.log('🗑️ Deleting RCPA report:', rcpaId);

        if (!req.tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
        }

        // Check if report exists and belongs to the user
        const existingReport = await req.tenantDb.rcpaReport.findFirst({
            where: {
                id: rcpaId,
                employeeId: req.user?.employeeId
            },
            include: {
                chemist: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (!existingReport) {
            return res.status(404).json({
                success: false,
                message: 'RCPA report not found or you do not have permission to delete this report'
            });
        }

        // Store report info for response before deletion
        const reportInfo = {
            rcpaId: existingReport.id,
            chemistName: existingReport.chemist?.name || 'Unknown Chemist',
            totalPrescriptions: existingReport.totalPrescription
        };

        // Delete RCPA report and its drug data in a transaction
        await req.tenantDb.$transaction(async (tx: any) => {
            console.log('🔥 Deleting drug data for RCPA report:', rcpaId);

            // Delete all drug data first (foreign key constraint)
            const deletedDrugData = await tx.rcpaDrugData.deleteMany({
                where: { rcpaReportId: rcpaId }
            });

            console.log(`✅ Deleted ${deletedDrugData.count} drug data entries`);

            console.log('🔥 Deleting RCPA report:', rcpaId);

            // Delete the RCPA report itself
            const deletedReport = await tx.rcpaReport.delete({
                where: { id: rcpaId }
            });

            console.log('✅ RCPA report deleted successfully');

            return deletedReport;
        });

        res.status(200).json({
            success: true,
            message: 'RCPA report and all its data have been permanently deleted',
            data: {
                deletedReport: reportInfo,
                deletedAt: new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error('❌ Error deleting RCPA report:', error);

        // Check if it's a foreign key constraint error
        if (error.code === 'P2003') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete RCPA report due to existing references. Please contact support.'
            });
        }

        // Check if it's a record not found error
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'RCPA report not found or already deleted'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete RCPA report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};