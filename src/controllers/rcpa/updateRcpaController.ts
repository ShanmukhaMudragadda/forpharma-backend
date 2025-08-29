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
 * PUT /api/rcpa/:rcpaId
 * Update RCPA report details
 */
export const updateRcpa = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { rcpaId } = req.params;
        const rcpaData = req.body;
        console.log('🔄 Updating RCPA report:', rcpaId);

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
            }
        });

        if (!existingReport) {
            return res.status(404).json({
                success: false,
                message: 'RCPA report not found or you do not have permission to update this report'
            });
        }

        // Update RCPA report with transaction
        const result = await req.tenantDb.$transaction(async (tx: any) => {
            // Update RCPA report
            const updatedReport = await tx.rcpaReport.update({
                where: { id: rcpaId },
                data: {
                    totalPrescription: rcpaData.totalPrescriptions,
                    remarks: rcpaData.remarks,
                    updatedAt: new Date()
                }
            });

            // Update drug data if provided
            if (rcpaData.drugData && Array.isArray(rcpaData.drugData)) {
                // Delete existing drug data
                await tx.rcpaDrugData.deleteMany({
                    where: { rcpaReportId: rcpaId }
                });

                // Create new drug data
                for (const drugItem of rcpaData.drugData) {
                    await tx.rcpaDrugData.create({
                        data: {
                            rcpaReportId: rcpaId,
                            drugId: drugItem.drugId || null,
                            competitorDrugName: drugItem.competitorDrugName || null,
                            ownQuantity: drugItem.ownQuantity || 0,
                            competitorQuantity: drugItem.competitorQuantity || 0,
                            ownPackSize: drugItem.ownPackSize || '',
                            competitorPackSize: drugItem.competitorPackSize || ''
                        }
                    });
                }
            }

            return updatedReport;
        });

        res.status(200).json({
            success: true,
            message: 'RCPA report updated successfully',
            data: {
                rcpaId: result.id,
                totalPrescriptions: result.totalPrescription,
                updatedAt: result.updatedAt
            }
        });

    } catch (error) {
        console.error('❌ Error updating RCPA report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update RCPA report',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};