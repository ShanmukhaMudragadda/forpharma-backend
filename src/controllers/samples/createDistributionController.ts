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
 * GET /api/samples/customers
 * Get all customers (doctors and chemists) in user's territory
 */
export const getCustomers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        console.log('👥 Getting customers for employee:', req.user?.employeeId);

        if (!req.tenantDb) {
            res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
            return;
        }

        // Get employee's territories
        const employeeTerritories = await req.tenantDb.employeeTerritory.findMany({
            where: {
                employeeId: req.user?.employeeId
            },
            select: {
                territoryId: true
            }
        });

        const territoryIds = employeeTerritories.map((et: any) => et.territoryId);

        if (territoryIds.length === 0) {
            res.status(200).json({
                success: true,
                message: 'No territories assigned to employee',
                data: []
            });
            return;
        }

        // Get doctors in employee's territories
        const doctors = await req.tenantDb.doctor.findMany({
            include: {
                hospitalAssociations: {
                    take: 1,
                    include: {
                        hospital: {
                            select: {
                                name: true,
                                address: true,
                                city: true,
                                state: true,
                                territoryId: true
                            }
                        }
                    },
                    where: {
                        hospital: {
                            territoryId: {
                                in: territoryIds
                            }
                        }
                    }
                }
            },
            where: {
                isActive: true,
                hospitalAssociations: {
                    some: {
                        hospital: {
                            territoryId: {
                                in: territoryIds
                            }
                        }
                    }
                }
            }
        });

        // Get chemists in employee's territories
        const chemists = await req.tenantDb.chemist.findMany({
            where: {
                territoryId: {
                    in: territoryIds
                },
                isActive: true
            }
        });

        // Transform doctors
        const transformedDoctors = doctors.map((doctor: any) => {
            const hospital = doctor.hospitalAssociations[0]?.hospital;
            return {
                id: doctor.id,
                name: doctor.name,
                type: 'doctor',
                designation: doctor.designation,
                specialization: doctor.specialization,
                address: {
                    name: hospital ? hospital.name : 'Hospital',
                    full: hospital
                        ? [hospital.address, hospital.city, hospital.state].filter(Boolean).join(', ')
                        : 'Address not available'
                }
            };
        });

        // Transform chemists
        const transformedChemists = chemists.map((chemist: any) => ({
            id: chemist.id,
            name: chemist.name,
            type: 'chemist',
            chemistType: chemist.type,
            address: {
                name: chemist.name,
                full: [chemist.address, chemist.city, chemist.state]
                    .filter(Boolean)
                    .join(', ') || 'Address not available'
            }
        }));

        // Combine and sort customers
        const allCustomers = [
            ...transformedDoctors,
            ...transformedChemists
        ].sort((a, b) => a.name.localeCompare(b.name));

        res.status(200).json({
            success: true,
            message: `Retrieved ${allCustomers.length} customers`,
            data: allCustomers
        });

    } catch (error) {
        console.error('❌ Error getting customers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve customers',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

/**
 * POST /api/samples/distributions
 * Create a new distribution
 */
export const createDistribution = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        console.log('📦 Creating new distribution for employee:', req.user?.employeeId);

        if (!req.tenantDb) {
            res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
            return;
        }

        const {
            customerId,
            customerType,
            distributedAt,
            drugItems = [],
            giftItems = []
        } = req.body;

        // Validate required fields
        if (!customerId || !customerType || !distributedAt) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields: customerId, customerType, distributedAt'
            });
            return;
        }

        if (drugItems.length === 0 && giftItems.length === 0) {
            res.status(400).json({
                success: false,
                message: 'At least one drug or gift item must be included'
            });
            return;
        }

        // Validate customer exists
        const customerExists = customerType === 'doctor'
            ? await req.tenantDb.doctor.findUnique({ where: { id: customerId, isActive: true } })
            : await req.tenantDb.chemist.findUnique({ where: { id: customerId, isActive: true } });

        if (!customerExists) {
            res.status(404).json({
                success: false,
                message: `${customerType} not found`
            });
            return;
        }

        // Start transaction
        const result = await req.tenantDb.$transaction(async (tx: any) => {
            // Create distribution
            const distribution = await tx.sampleDistribution.create({
                data: {
                    doctorId: customerType === 'doctor' ? customerId : null,
                    chemistId: customerType === 'chemist' ? customerId : null,
                    employeeId: req.user?.employeeId,
                    distributedAt: new Date(distributedAt)
                }
            });

            // Process drug items
            for (const drugItem of drugItems) {
                const { inventoryId, quantity } = drugItem;

                // Get inventory item
                const inventory = await tx.userDrugInventory.findUnique({
                    where: { id: inventoryId },
                    include: { drug: true }
                });

                if (!inventory) {
                    throw new Error(`Drug inventory item ${inventoryId} not found`);
                }

                if (inventory.quantity < quantity) {
                    throw new Error(`Insufficient quantity for ${inventory.drug.name}. Available: ${inventory.quantity}, Requested: ${quantity}`);
                }

                // Create distribution drug item
                await tx.sampleDistributionDrugItem.create({
                    data: {
                        sampleDistributionId: distribution.id,
                        fromInventoryId: inventoryId,
                        quantity: quantity,
                        unitCost: inventory.drug.price || 0,
                        totalCost: (inventory.drug.price || 0) * quantity
                    }
                });

                // Update inventory quantity
                await tx.userDrugInventory.update({
                    where: { id: inventoryId },
                    data: {
                        quantity: inventory.quantity - quantity
                    }
                });
            }

            // Process gift items
            for (const giftItem of giftItems) {
                const { inventoryId, quantity } = giftItem;

                // Get inventory item
                const inventory = await tx.userGiftInventory.findUnique({
                    where: { id: inventoryId },
                    include: { gift: true }
                });

                if (!inventory) {
                    throw new Error(`Gift inventory item ${inventoryId} not found`);
                }

                if (inventory.quantity < quantity) {
                    throw new Error(`Insufficient quantity for ${inventory.gift.name}. Available: ${inventory.quantity}, Requested: ${quantity}`);
                }

                // Create distribution gift item
                await tx.sampleDistributionGiftItem.create({
                    data: {
                        sampleDistributionId: distribution.id,
                        fromInventoryId: inventoryId,
                        quantity: quantity,
                        unitCost: inventory.gift.unitCost || 0,
                        totalCost: (inventory.gift.unitCost || 0) * quantity
                    }
                });

                // Update inventory quantity
                await tx.userGiftInventory.update({
                    where: { id: inventoryId },
                    data: {
                        quantity: inventory.quantity - quantity
                    }
                });
            }

            return distribution;
        });

        res.status(201).json({
            success: true,
            message: 'Distribution created successfully',
            data: {
                distributionId: result.id,
                customerId: customerId,
                customerType: customerType,
                distributedAt: result.distributedAt,
                drugItemsCount: drugItems.length,
                giftItemsCount: giftItems.length
            }
        });

    } catch (error: any) {
        console.error('❌ Error creating distribution:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create distribution',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};