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
 * DELETE /api/dcr/:dcrId
 * Delete a DCR report (only drafts can be deleted)
 */
export const deleteDcr = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { dcrId } = req.params;
        console.log('🗑️ Deleting DCR:', dcrId);

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
                message: 'DCR report not found or you do not have permission to delete this report'
            });
            return;
        }

        // Only allow deleting draft DCRs
        if (!existingDCR.isDraft) {
            res.status(400).json({
                success: false,
                message: 'Only draft DCR reports can be deleted'
            });
            return;
        }

        // Delete the DCR
        await req.tenantDb.dcrReport.delete({
            where: {
                id: dcrId
            }
        });

        res.status(200).json({
            success: true,
            message: 'DCR report deleted successfully',
            data: {
                deletedDCRId: dcrId
            }
        });

    } catch (error) {
        console.error('❌ Error deleting DCR:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete DCR report',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};