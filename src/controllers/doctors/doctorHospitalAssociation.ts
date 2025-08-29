import { Request, Response } from 'express';

// Helper function - should be outside the controller
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};



// DoctorHospitalAssociation

export const createDoctorHospitalAssociation = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const { doctorId, hospitalId, department, position, isPrimary, associationStartDate, associationEndDate } = req.body;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!doctorId || !hospitalId) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID and Hospital ID are required'
            });
        }

        // Check if association already exists
        const existingAssociation = await tenantDb.doctorHospitalAssociation.findUnique({
            where: {
                doctorId_hospitalId: {
                    doctorId,
                    hospitalId
                }
            }
        });

        if (existingAssociation) {
            return res.status(409).json({
                success: false,
                message: 'Association already exists between this doctor and hospital'
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

        // Check if hospital exists
        const hospitalExists = await tenantDb.hospital.findUnique({
            where: { id: hospitalId }
        });

        if (!hospitalExists) {
            return res.status(404).json({
                success: false,
                message: 'Hospital not found'
            });
        }

        // If isPrimary is true, unset other primary associations for this doctor
        if (isPrimary) {
            await tenantDb.doctorHospitalAssociation.updateMany({
                where: {
                    doctorId,
                    isPrimary: true
                },
                data: {
                    isPrimary: false
                }
            });
        }

        // Create the association
        const association = await tenantDb.doctorHospitalAssociation.create({
            data: {
                doctorId,
                hospitalId,
                department,
                position,
                isPrimary: isPrimary || false,
                associationStartDate: associationStartDate ? new Date(associationStartDate) : null,
                associationEndDate: associationEndDate ? new Date(associationEndDate) : null
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true,
                        email: true
                    }
                },
                hospital: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true
                    }
                }
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Doctor-hospital association created successfully',
            association
        });

    } catch (error: any) {
        console.error('Error creating doctor-hospital association:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while creating the association',
            error: error.message
        });
    }
};



// Get all hospitals associated with a doctor
export const getDoctorHospitals = async (req: Request, res: Response) => {
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
            where: { id: doctorId }
        });

        if (!doctorExists) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Fetch all hospital associations for the doctor
        const associations = await tenantDb.doctorHospitalAssociation.findMany({
            where: {
                doctorId
            },
            include: {
                hospital: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true,
                        state: true,
                        pincode: true,
                        phone: true,
                        email: true
                    }
                }
            },
            orderBy: [
                { isPrimary: 'desc' },
                { associationStartDate: 'desc' }
            ]
        });

        return res.status(200).json({
            success: true,
            message: 'Doctor hospitals fetched successfully',
            data: {
                doctorId,
                doctorName: doctorExists.name,
                hospitals: associations
            }
        });

    } catch (error: any) {
        console.error('Error fetching doctor hospitals:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching doctor hospitals',
            error: error.message
        });
    }
};


// Update a doctor-hospital association
export const updateDoctorHospitalAssociation = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const associationId = req.params.associationId;
        const { department, position, isPrimary, associationStartDate, associationEndDate } = req.body;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!associationId) {
            return res.status(400).json({
                success: false,
                message: 'Association ID is required'
            });
        }

        // Check if association exists
        const existingAssociation = await tenantDb.doctorHospitalAssociation.findUnique({
            where: { id: associationId }
        });

        if (!existingAssociation) {
            return res.status(404).json({
                success: false,
                message: 'Association not found'
            });
        }

        // If setting isPrimary to true, unset other primary associations for this doctor
        if (isPrimary === true) {
            await tenantDb.doctorHospitalAssociation.updateMany({
                where: {
                    doctorId: existingAssociation.doctorId,
                    isPrimary: true,
                    NOT: { id: associationId }
                },
                data: {
                    isPrimary: false
                }
            });
        }

        // Update the association
        const updatedAssociation = await tenantDb.doctorHospitalAssociation.update({
            where: { id: associationId },
            data: {
                department,
                position,
                isPrimary,
                associationStartDate: associationStartDate ? new Date(associationStartDate) : undefined,
                associationEndDate: associationEndDate ? new Date(associationEndDate) : undefined
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true
                    }
                },
                hospital: {
                    select: {
                        id: true,
                        name: true,
                        city: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Association updated successfully',
            association: updatedAssociation
        });

    } catch (error: any) {
        console.error('Error updating association:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the association',
            error: error.message
        });
    }
};

// Delete a doctor-hospital association
export const deleteDoctorHospitalAssociation = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const associationId = req.params.associationId;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!associationId) {
            return res.status(400).json({
                success: false,
                message: 'Association ID is required'
            });
        }

        // Check if association exists
        const association = await tenantDb.doctorHospitalAssociation.findUnique({
            where: { id: associationId }
        });

        if (!association) {
            return res.status(404).json({
                success: false,
                message: 'Association not found'
            });
        }

        // Delete the association
        await tenantDb.doctorHospitalAssociation.delete({
            where: { id: associationId }
        });

        return res.status(200).json({
            success: true,
            message: 'Association deleted successfully'
        });

    } catch (error: any) {
        console.error('Error deleting association:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the association',
            error: error.message
        });
    }
};

// Set primary hospital for a doctor
export const setPrimaryHospital = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const { doctorId, hospitalId } = req.params;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!doctorId || !hospitalId) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID and Hospital ID are required'
            });
        }

        // Check if association exists
        const association = await tenantDb.doctorHospitalAssociation.findUnique({
            where: {
                doctorId_hospitalId: {
                    doctorId,
                    hospitalId
                }
            }
        });

        if (!association) {
            return res.status(404).json({
                success: false,
                message: 'Association not found'
            });
        }

        // Transaction to update primary status
        await tenantDb.$transaction([
            // Unset all primary associations for this doctor
            tenantDb.doctorHospitalAssociation.updateMany({
                where: {
                    doctorId,
                    isPrimary: true
                },
                data: {
                    isPrimary: false
                }
            }),
            // Set the specified association as primary
            tenantDb.doctorHospitalAssociation.update({
                where: {
                    doctorId_hospitalId: {
                        doctorId,
                        hospitalId
                    }
                },
                data: {
                    isPrimary: true
                }
            })
        ]);

        const updatedAssociation = await tenantDb.doctorHospitalAssociation.findUnique({
            where: {
                doctorId_hospitalId: {
                    doctorId,
                    hospitalId
                }
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                hospital: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Primary hospital set successfully',
            association: updatedAssociation
        });

    } catch (error: any) {
        console.error('Error setting primary hospital:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while setting primary hospital',
            error: error.message
        });
    }
};
