import { Request, Response } from 'express';

// Helper function - should be outside the controller
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};


// DoctorChemistRelation Controllers

// Create a new doctor-chemist relation
export const createDoctorChemistRelation = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const { doctorId, chemistId } = req.body;
        const createdById = req.user?.id; // Assuming user info is attached to request

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!doctorId || !chemistId) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID and Chemist ID are required'
            });
        }

        if (!createdById) {
            return res.status(401).json({
                success: false,
                message: 'User authentication required'
            });
        }

        // Check if doctor exists
        const doctorExists = await tenantDb.doctor.findUnique({
            where: { id: doctorId }
        });

        if (!doctorExists) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Check if chemist exists
        const chemistExists = await tenantDb.chemist.findUnique({
            where: { id: chemistId }
        });

        if (!chemistExists) {
            return res.status(404).json({
                success: false,
                message: 'Chemist not found'
            });
        }

        // Check if relation already exists
        const existingRelation = await tenantDb.doctorChemistRelation.findFirst({
            where: {
                doctorId,
                chemistId
            }
        });

        if (existingRelation) {
            return res.status(409).json({
                success: false,
                message: 'Relation already exists between this doctor and chemist'
            });
        }

        // Create the relation
        const relation = await tenantDb.doctorChemistRelation.create({
            data: {
                doctorId,
                chemistId,
                createdById
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true
                    }
                },
                chemist: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
                createdBy: {
                    select: {
                        id: true,
                        email: true
                    }
                }
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Doctor-chemist relation created successfully',
            relation
        });

    } catch (error: any) {
        console.error('Error creating doctor-chemist relation:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while creating the relation',
            error: error.message
        });
    }
};

// Get all chemists related to a doctor
export const getChemistsForDoctor = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const doctorId = req.params.doctorId;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!doctorId) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID is required'
            });
        }

        // Check if doctor exists
        const doctorExists = await tenantDb.doctor.findUnique({
            where: { id: doctorId },
            select: {
                id: true,
                name: true,
                specialization: true
            }
        });

        if (!doctorExists) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Fetch all chemist relations for the doctor
        const relations = await tenantDb.doctorChemistRelation.findMany({
            where: {
                doctorId
            },
            include: {
                chemist: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        email: true,
                        phone: true,
                        address: true,
                        city: true,
                        state: true
                    }
                },
                createdBy: {
                    select: {
                        id: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Doctor chemists fetched successfully',
            data: {
                doctor: doctorExists,
                chemists: relations
            }
        });

    } catch (error: any) {
        console.error('Error fetching doctor chemists:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching doctor chemists',
            error: error.message
        });
    }
};

// Get all doctors related to a chemist
export const getDoctorsForChemist = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const chemistId = req.params.chemistId;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!chemistId) {
            return res.status(400).json({
                success: false,
                message: 'Chemist ID is required'
            });
        }

        // Check if chemist exists
        const chemistExists = await tenantDb.chemist.findUnique({
            where: { id: chemistId },
            select: {
                id: true,
                name: true,
                type: true
            }
        });

        if (!chemistExists) {
            return res.status(404).json({
                success: false,
                message: 'Chemist not found'
            });
        }

        // Fetch all doctor relations for the chemist
        const relations = await tenantDb.doctorChemistRelation.findMany({
            where: {
                chemistId
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true,
                        email: true,
                        phone: true,
                        qualification: true
                    }
                },
                createdBy: {
                    select: {
                        id: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Chemist doctors fetched successfully',
            data: {
                chemist: chemistExists,
                doctors: relations
            }
        });

    } catch (error: any) {
        console.error('Error fetching chemist doctors:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching chemist doctors',
            error: error.message
        });
    }
};

// Delete a doctor-chemist relation
export const deleteDoctorChemistRelation = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const relationId = req.params.relationId;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!relationId) {
            return res.status(400).json({
                success: false,
                message: 'Relation ID is required'
            });
        }

        // Check if relation exists
        const relation = await tenantDb.doctorChemistRelation.findUnique({
            where: { id: relationId }
        });

        if (!relation) {
            return res.status(404).json({
                success: false,
                message: 'Relation not found'
            });
        }

        // Delete the relation
        await tenantDb.doctorChemistRelation.delete({
            where: { id: relationId }
        });

        return res.status(200).json({
            success: true,
            message: 'Doctor-chemist relation deleted successfully'
        });

    } catch (error: any) {
        console.error('Error deleting relation:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the relation',
            error: error.message
        });
    }
};