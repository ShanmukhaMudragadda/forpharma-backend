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
 * GET /api/rcpa/:rcpaId
 * Get detailed information about a specific RCPA report
 */
export const getRcpaDetails = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { rcpaId } = req.params;
        console.log('🔍 Getting RCPA details for:', rcpaId);

        if (!req.tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
        }

        const rcpaReport = await req.tenantDb.rcpaReport.findFirst({
            where: {
                id: rcpaId,
                employeeId: req.user?.employeeId // Ensure user can only access their own reports
            },
            include: {
                chemist: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        address: true,
                        city: true,
                        state: true,
                        pincode: true,
                        type: true
                    }
                },
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                drugData: {
                    include: {
                        drug: {
                            select: {
                                id: true,
                                name: true,
                                composition: true,
                                manufacturer: true,
                                category: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'asc'
                    }
                }
            }
        });

        if (!rcpaReport) {
            return res.status(404).json({
                success: false,
                message: 'RCPA report not found or you do not have permission to view this report'
            });
        }

        // Transform drug data into audit items format expected by frontend
        const auditItems = rcpaReport.drugData.map((drugData: any) => {
            const ourProduct = {
                id: drugData.drugId || `own-${drugData.id}`,
                name: drugData.drug?.name || 'Unknown Product',
                quantity: drugData.ownQuantity,
                packSize: drugData.ownPackSize,
                manufacturer: drugData.drug?.manufacturer || 'N/A'
            };

            const competitor = {
                id: `competitor-${drugData.id}`,
                name: drugData.competitorDrugName || 'Unknown Competitor',
                quantity: drugData.competitorQuantity,
                packSize: drugData.competitorPackSize,
                manufacturer: 'N/A'
            };

            return {
                id: drugData.id,
                ourProduct,
                competitor
            };
        });

        // Calculate competitors found (unique competitor drug names)
        const uniqueCompetitors = new Set();
        rcpaReport.drugData.forEach((drugData: any) => {
            if (drugData.competitorDrugName) {
                uniqueCompetitors.add(drugData.competitorDrugName);
            }
        });

        // Build full address string
        const addressParts = [
            rcpaReport.chemist?.address,
            rcpaReport.chemist?.city,
            rcpaReport.chemist?.state,
            rcpaReport.chemist?.pincode
        ].filter(Boolean);
        const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Address not available';

        // Transform RCPA details for frontend (matching the expected structure)
        const rcpaDetails = {
            // Basic info
            rcpaId: rcpaReport.id,
            chemistId: rcpaReport.chemist?.id || '',
            chemistName: rcpaReport.chemist?.name || 'Unknown Chemist',

            // Dates
            observationDate: rcpaReport.createdAt.toISOString(),

            // Employee info
            createdBy: {
                name: `${rcpaReport.employee?.firstName || ''} ${rcpaReport.employee?.lastName || ''}`.trim() || 'Unknown Employee',
                email: rcpaReport.employee?.email || ''
            },

            // Statistics
            totalPrescriptions: rcpaReport.totalPrescription || 0,
            itemsAudited: rcpaReport.drugData.length,
            competitorsFound: uniqueCompetitors.size,

            // Location info
            region: `${rcpaReport.chemist?.city || 'Unknown'}, ${rcpaReport.chemist?.state || 'Unknown'}`,

            // Remarks
            briefRemarks: rcpaReport.remarks || '',

            // Audit items
            auditItems: auditItems,

            // Additional chemist details
            chemistDetails: {
                email: rcpaReport.chemist?.email,
                phone: rcpaReport.chemist?.phone,
                address: fullAddress,
                type: rcpaReport.chemist?.type
            },

            // Meta info
            reportingPeriod: rcpaReport.reportingPeriod,
            startDate: rcpaReport.startDate.toISOString(),
            endDate: rcpaReport.endDate.toISOString(),
            createdAt: rcpaReport.createdAt.toISOString(),
            updatedAt: rcpaReport.updatedAt.toISOString()
        };

        res.status(200).json({
            success: true,
            message: 'RCPA report details retrieved successfully',
            data: rcpaDetails
        });

    } catch (error) {
        console.error('❌ Error getting RCPA details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve RCPA details',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};