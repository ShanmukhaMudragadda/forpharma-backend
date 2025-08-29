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
 * Parse date string (supports multiple formats)
 * Handles: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, and formats with spaces
 */
const parseDate = (dateString: string): Date | null => {
    if (!dateString || typeof dateString !== 'string') {
        console.log('❌ Invalid date string:', dateString);
        return null;
    }

    // Remove any extra whitespace and normalize spaces around dashes
    let cleanDateString = dateString.trim();
    // Replace "DD - MM - YYYY" with "DD-MM-YYYY"
    cleanDateString = cleanDateString.replace(/\s*-\s*/g, '-');
    // Replace "DD / MM / YYYY" with "DD/MM/YYYY" 
    cleanDateString = cleanDateString.replace(/\s*\/\s*/g, '/');

    console.log('📅 Parsing date string:', dateString, '→ cleaned:', cleanDateString);

    try {
        // Handle YYYY-MM-DD format (ISO format from frontend)
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateString)) {
            console.log('📅 Detected YYYY-MM-DD format');
            const date = new Date(cleanDateString + 'T00:00:00.000Z');
            if (!isNaN(date.getTime())) {
                console.log('✅ Successfully parsed YYYY-MM-DD:', date);
                return date;
            }
        }

        // Handle DD-MM-YYYY format
        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleanDateString)) {
            console.log('📅 Detected DD-MM-YYYY format');
            const parts = cleanDateString.split('-');
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            // Create date (month is 0-based in JavaScript Date)
            const date = new Date(year, month - 1, day);

            // Validate the date components
            if (date.getFullYear() === year &&
                date.getMonth() === month - 1 &&
                date.getDate() === day &&
                month >= 1 && month <= 12 &&
                day >= 1 && day <= 31) {
                console.log('✅ Successfully parsed DD-MM-YYYY:', date);
                return date;
            }
        }

        // Handle DD/MM/YYYY format (fallback for backward compatibility)
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanDateString)) {
            console.log('📅 Detected DD/MM/YYYY format');
            const parts = cleanDateString.split('/');
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            // Create date (month is 0-based in JavaScript Date)
            const date = new Date(year, month - 1, day);

            // Validate the date components
            if (date.getFullYear() === year &&
                date.getMonth() === month - 1 &&
                date.getDate() === day &&
                month >= 1 && month <= 12 &&
                day >= 1 && day <= 31) {
                console.log('✅ Successfully parsed DD/MM/YYYY:', date);
                return date;
            }
        }

        console.log('❌ No matching date format found for:', cleanDateString);
        return null;

    } catch (error) {
        console.error('❌ Error parsing date:', error);
        return null;
    }
};

/**
 * GET /api/rcpa/drugs
 * Get available drugs for RCPA creation (simplified - no pack size)
 */
export const getDrugsForRcpa = async (req: AuthenticatedRequest, res: Response) => {
    try {
        console.log('💊 Getting drugs for RCPA creation');

        if (!req.tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
        }

        const drugs = await req.tenantDb.drug.findMany({
            where: {
                isActive: true,
                isAvailable: true
            },
            select: {
                id: true,
                name: true,
                composition: true,
                manufacturer: true,
                category: true,
                price: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Transform drugs for RCPA (pack size will be entered manually by user)
        const transformedDrugs = drugs.map(drug => ({
            id: drug.id,
            name: drug.name,
            composition: drug.composition,
            manufacturer: drug.manufacturer || 'N/A',
            category: drug.category,
            price: drug.price ? parseFloat(drug.price.toString()) : 0
        }));

        res.status(200).json({
            success: true,
            message: `Retrieved ${transformedDrugs.length} drugs for RCPA`,
            data: transformedDrugs
        });

    } catch (error) {
        console.error('❌ Error getting drugs for RCPA:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve drugs for RCPA',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

/**
 * POST /api/rcpa
 * Create a new RCPA report
 */
export const createRcpa = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const rcpaData = req.body;
        console.log('📝 Creating new RCPA report for employee:', req.user?.employeeId);
        console.log('📝 Received RCPA data:', JSON.stringify(rcpaData, null, 2));

        if (!req.tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
        }

        // Validate required fields
        if (!rcpaData.chemistId || !rcpaData.reportingPeriod || !rcpaData.startDate || !rcpaData.endDate) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: chemistId, reportingPeriod, startDate, and endDate are required'
            });
        }

        // Validate chemist exists
        const chemist = await req.tenantDb.chemist.findFirst({
            where: {
                id: rcpaData.chemistId,
                isActive: true
            }
        });

        if (!chemist) {
            return res.status(404).json({
                success: false,
                message: 'Chemist not found or inactive'
            });
        }

        // Parse and validate dates with better error messages
        console.log('🗓️ Parsing dates:');
        console.log('  - Start date string:', rcpaData.startDate, '(type:', typeof rcpaData.startDate, ')');
        console.log('  - End date string:', rcpaData.endDate, '(type:', typeof rcpaData.endDate, ')');

        const startDate = parseDate(rcpaData.startDate);
        const endDate = parseDate(rcpaData.endDate);

        console.log('  - Parsed start date:', startDate);
        console.log('  - Parsed end date:', endDate);

        if (!startDate) {
            return res.status(400).json({
                success: false,
                message: `Invalid start date format: "${rcpaData.startDate}". Please use YYYY-MM-DD, DD-MM-YYYY, or DD/MM/YYYY format`,
                debug: {
                    received: rcpaData.startDate,
                    type: typeof rcpaData.startDate,
                    supportedFormats: ['YYYY-MM-DD', 'DD-MM-YYYY', 'DD/MM/YYYY']
                }
            });
        }

        if (!endDate) {
            return res.status(400).json({
                success: false,
                message: `Invalid end date format: "${rcpaData.endDate}". Please use YYYY-MM-DD, DD-MM-YYYY, or DD/MM/YYYY format`,
                debug: {
                    received: rcpaData.endDate,
                    type: typeof rcpaData.endDate,
                    supportedFormats: ['YYYY-MM-DD', 'DD-MM-YYYY', 'DD/MM/YYYY']
                }
            });
        }

        // Validate date logic
        if (startDate >= endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date must be before end date',
                debug: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }
            });
        }

        // Check if dates are not in the future (optional business rule)
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (startDate > today || endDate > today) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date cannot be in the future',
                debug: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    today: today.toISOString()
                }
            });
        }

        // Validate reporting period duration
        const diffTime = endDate.getTime() - startDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (rcpaData.reportingPeriod === 'WEEKLY' && diffDays > 7) {
            return res.status(400).json({
                success: false,
                message: `Weekly reporting period cannot exceed 7 days. Current selection: ${diffDays} days`,
                debug: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    days: diffDays
                }
            });
        }

        if (rcpaData.reportingPeriod === 'MONTHLY' && diffDays > 31) {
            return res.status(400).json({
                success: false,
                message: `Monthly reporting period cannot exceed 31 days. Current selection: ${diffDays} days`,
                debug: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    days: diffDays
                }
            });
        }

        // Create RCPA report with transaction
        const result = await req.tenantDb.$transaction(async (tx: any) => {
            // Create RCPA report
            const rcpaReport = await tx.rcpaReport.create({
                data: {
                    organizationId: req.user?.organizationId,
                    employeeId: req.user?.employeeId,
                    chemistId: rcpaData.chemistId,
                    reportingPeriod: rcpaData.reportingPeriod,
                    startDate: startDate,
                    endDate: endDate,
                    totalPrescription: rcpaData.totalPrescriptions || null,
                    remarks: rcpaData.remarks || null
                }
            });

            // Create drug data if provided
            if (rcpaData.drugData && Array.isArray(rcpaData.drugData)) {
                console.log(`📊 Creating ${rcpaData.drugData.length} drug data entries`);
                for (const drugItem of rcpaData.drugData) {
                    await tx.rcpaDrugData.create({
                        data: {
                            rcpaReportId: rcpaReport.id,
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

            return rcpaReport;
        });

        // Fetch created report with relations for response
        const createdReport = await req.tenantDb.rcpaReport.findUnique({
            where: { id: result.id },
            include: {
                chemist: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                employee: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                },
                drugData: true
            }
        });

        console.log('✅ RCPA report created successfully:', result.id);

        res.status(201).json({
            success: true,
            message: 'RCPA report created successfully',
            data: {
                rcpaId: createdReport.id,
                chemistName: createdReport.chemist?.name,
                reportingPeriod: createdReport.reportingPeriod,
                totalPrescriptions: createdReport.totalPrescription,
                drugCount: createdReport.drugData.length,
                createdBy: `${createdReport.employee?.firstName || ''} ${createdReport.employee?.lastName || ''}`.trim(),
                startDate: createdReport.startDate.toISOString(),
                endDate: createdReport.endDate.toISOString()
            }
        });

    } catch (error: any) {
        console.error('❌ Error creating RCPA report:', error);

        // Handle specific database errors
        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: 'Duplicate RCPA report. A similar report already exists for this period.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create RCPA report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};