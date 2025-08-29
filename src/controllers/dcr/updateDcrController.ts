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
 * PUT /api/dcr/:dcrId
 * Update an existing DCR report (only drafts can be updated)
 */
export const updateDcr = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { dcrId } = req.params;
        const updateData = req.body;
        console.log('🔄 Updating DCR:', dcrId, 'for employee:', req.user?.employeeId);

        if (!req.tenantDb) {
            res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
            return;
        }

        // Check if DCR exists and belongs to the user
        const existingDCR = await req.tenantDb.dcrReport.findFirst({
            where: {
                id: dcrId,
                employeeId: req.user?.employeeId
            }
        });

        if (!existingDCR) {
            res.status(404).json({
                success: false,
                message: 'DCR report not found or you do not have permission to update this report'
            });
            return;
        }

        // Only allow updating draft DCRs
        if (!existingDCR.isDraft) {
            res.status(400).json({
                success: false,
                message: 'Only draft DCR reports can be updated'
            });
            return;
        }

        // Validate that at least one field is filled
        if (!updateData.productsDiscussed?.trim() && !updateData.comments?.trim()) {
            res.status(400).json({
                success: false,
                message: 'Either Products Discussed or Comments must be provided'
            });
            return;
        }

        // Update the DCR report
        const updatedDCR = await req.tenantDb.dcrReport.update({
            where: {
                id: dcrId
            },
            data: {
                productsDiscussed: updateData.productsDiscussed?.trim() || null,
                comments: updateData.comments?.trim() || null,
                isDraft: updateData.isDraft === true,
                updatedAt: new Date()
            }
        });

        res.status(200).json({
            success: true,
            message: `DCR ${updateData.isDraft ? 'updated and saved as draft' : 'updated and submitted'} successfully`,
            data: {
                dcrId: updatedDCR.id,
                status: updatedDCR.isDraft ? 'draft' : 'completed',
                reportDate: updatedDCR.reportDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
            }
        });

    } catch (error) {
        console.error('❌ Error updating DCR:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update DCR report',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};