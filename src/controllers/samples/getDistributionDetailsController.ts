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
 * Format date for display
 */
const formatDate = (date: Date): string => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 2) {
        return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

/**
 * Get customer location details
 */
const getCustomerLocation = (customer: any, customerType: string): { name: string; address: string } => {
    if (customerType === 'doctor' && customer.hospitalAssociations?.length > 0) {
        const hospital = customer.hospitalAssociations[0].hospital;
        return {
            name: hospital.name || 'Hospital',
            address: [hospital.address, hospital.city, hospital.state]
                .filter(Boolean)
                .join(', ') || 'Address not available'
        };
    } else if (customerType === 'chemist') {
        return {
            name: customer.name || 'Chemist',
            address: [customer.address, customer.city, customer.state]
                .filter(Boolean)
                .join(', ') || 'Address not available'
        };
    }

    return {
        name: 'Location',
        address: 'Address not available'
    };
};

/**
 * GET /api/samples/distributions/:distributionId
 * Get distribution details by ID
 */
export const getDistributionDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { distributionId } = req.params;
        console.log('📋 Getting distribution details for:', distributionId);

        if (!req.tenantDb) {
            res.status(500).json({
                success: false,
                message: 'Tenant database connection not available'
            });
            return;
        }

        const distribution = await req.tenantDb.sampleDistribution.findUnique({
            where: {
                id: distributionId,
                employeeId: req.user?.employeeId // Ensure user can only access their distributions
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        hospitalAssociations: {
                            take: 1,
                            include: {
                                hospital: {
                                    select: {
                                        name: true,
                                        address: true,
                                        city: true,
                                        state: true
                                    }
                                }
                            }
                        }
                    }
                },
                chemist: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true,
                        state: true
                    }
                },
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                drugItems: {
                    include: {
                        fromInventory: {
                            include: {
                                drug: {
                                    select: {
                                        name: true,
                                        dosageForms: true
                                    }
                                }
                            }
                        }
                    }
                },
                giftItems: {
                    include: {
                        fromInventory: {
                            include: {
                                gift: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!distribution) {
            res.status(404).json({
                success: false,
                message: 'Distribution not found'
            });
            return;
        }

        // Determine customer type and details
        const customer = distribution.doctor || distribution.chemist;
        const customerType = distribution.doctor ? 'doctor' : 'chemist';

        if (!customer) {
            res.status(400).json({
                success: false,
                message: 'Distribution customer not found'
            });
            return;
        }

        // Get location details
        const location = getCustomerLocation(customer, customerType);

        // Transform drug items
        const drugs = distribution.drugItems.map((item: any) => ({
            id: item.id,
            name: item.fromInventory.drug.name,
            quantity: item.quantity,
            type: 'drug' as const,
            unitCost: parseFloat(item.unitCost.toString()),
            totalCost: parseFloat(item.totalCost.toString())
        }));

        // Transform gift items
        const gifts = distribution.giftItems.map((item: any) => ({
            id: item.id,
            name: item.fromInventory.gift.name,
            quantity: item.quantity,
            type: 'gift' as const,
            unitCost: parseFloat(item.unitCost.toString()),
            totalCost: parseFloat(item.totalCost.toString())
        }));

        // Calculate total items
        const totalItems = drugs.reduce((sum: number, item: any) => sum + item.quantity, 0) +
            gifts.reduce((sum: number, item: any) => sum + item.quantity, 0);

        const distributionDetails = {
            distributionId: distribution.id,
            customer: {
                name: customer.name,
                id: customer.id,
                type: customerType
            },
            createdBy: {
                name: `${distribution.employee.firstName} ${distribution.employee.lastName || ''}`.trim(),
                id: distribution.employee.id
            },
            distributionDate: formatDate(distribution.distributedAt),
            location: location,
            drugs: drugs,
            gifts: gifts,
            totalItems: totalItems,
            createdAt: distribution.createdAt.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })
        };

        res.status(200).json({
            success: true,
            message: 'Distribution details retrieved successfully',
            data: distributionDetails
        });

    } catch (error) {
        console.error('❌ Error getting distribution details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve distribution details',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};