import { Request, Response } from 'express';

// Helper function - should be outside the controller
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};


export const createDoctorController = async (req: Request, res: Response) => {
    try {
        const {
            name,
            designation,
            specialization,
            email,
            phone,
            description,
            qualification,
            experienceYears
        } = req.body;

        const tenantDb = req.tenantDb;
        const organizationId = req.user?.organizationId;
        const createdById = req.user?.id;

        // Check if tenantDb exists
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        // Validation
        if (!name || !organizationId || !createdById) {
            return res.status(400).json({
                success: false,
                message: 'Name, organization ID, and creator ID are required'
            });
        }

        // Email validation if provided
        if (email && !isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Check if doctor with email already exists (only if email is provided)
        if (email) {
            const existingDoctor = await tenantDb.doctor.findFirst({
                where: { email }
            });

            if (existingDoctor) {
                return res.status(400).json({
                    success: false,
                    message: 'Doctor with this email already exists'
                });
            }
        }

        // Create doctor with related data in a transaction
        // Create the doctor
        const newDoctor = await tenantDb.doctor.create({
            data: {
                organizationId,
                name,
                designation,
                specialization,
                email,
                phone,
                description,
                qualification,
                experienceYears,
                createdById,
                isActive: true
            },
        });


        console.log(`Doctor "${name}" created successfully in tenant schema`);

        // Return success response
        return res.status(201).json({
            success: true,
            message: 'Doctor created successfully',
            data: newDoctor
        });

    } catch (error: any) {
        console.error('Error in Doctor Creation:', error);
        // Generic error response
        return res.status(500).json({
            success: false,
            message: 'Doctor creation failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const updateDoctor = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const doctorId = req.params.doctorId;
        const {
            name,
            designation,
            specialization,
            email,
            phone,
            description,
            profilePictureUrl,
            qualification,
            experienceYears
        } = req.body;

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

        // Check if doctor exists and is active
        const existingDoctor = await tenantDb.doctor.findFirst({
            where: {
                id: doctorId,
                isActive: true
            }
        });

        if (!existingDoctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found or is not active'
            });
        }

        // Update the doctor
        const updatedDoctor = await tenantDb.doctor.update({
            where: { id: doctorId },
            data: {
                name,
                designation,
                specialization,
                email,
                phone,
                description,
                profilePictureUrl,
                qualification,
                experienceYears
            },
            select: {
                id: true,
                organizationId: true,
                name: true,
                designation: true,
                specialization: true,
                email: true,
                phone: true,
                description: true,
                profilePictureUrl: true,
                qualification: true,
                experienceYears: true,
                isActive: true,
                createdAt: true,
                updatedAt: true
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Doctor details updated successfully',
            doctor: updatedDoctor
        });

    } catch (error: any) {
        console.error('Error updating doctor:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating doctor details',
            error: error.message
        });
    }
};

// Soft delete doctor (set isActive to false)
export const deleteDoctor = async (req: Request, res: Response) => {
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

        // Check if doctor exists and is active
        const existingDoctor = await tenantDb.doctor.findFirst({
            where: {
                id: doctorId,
                isActive: true
            }
        });

        if (!existingDoctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found or is already inactive'
            });
        }

        // Perform soft delete by setting isActive to false
        const deactivatedDoctor = await tenantDb.doctor.update({
            where: { id: doctorId },
            data: {
                isActive: false
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                specialization: true,
                isActive: true,
                updatedAt: true
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Doctor deactivated successfully',
            doctor: deactivatedDoctor
        });

    } catch (error: any) {
        console.error('Error deleting doctor:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while deactivating the doctor',
            error: error.message
        });
    }
};


export const getDoctorListController = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        // const userId = req.user?.id;
        const email = req.user?.email;
        const organizationId = req.user?.organizationId;

        // Check if tenantDb exists
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        // Validation
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await tenantDb.employee.findUnique({
            where: {
                email: email
            },
            select: {
                id: true
            }
        })
        console.log(`employee in tenant db: ${user?.id}`);

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User Not present in Employee table'
            });
        }

        const userId = user.id;


        // Step 1: Get user's territories (active assignments only)
        const userTerritories = await tenantDb.employeeTerritory.findMany({
            where: {
                employeeId: userId,
                unassignedAt: null // Only active territory assignments
            },
            select: {
                territoryId: true,
                isPrimary: true
            }
        });

        console.log(`employee in tenant db: ${userTerritories.length}`);

        if (userTerritories.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No territories assigned to user',
                data: []
            });
        }

        // Extract territory IDs with proper typing
        const territoryIds = userTerritories.map((ut: { territoryId: string }) => ut.territoryId);

        // Step 2: Get all hospitals in user's territories
        const hospitals = await tenantDb.hospital.findMany({
            where: {
                territoryId: {
                    in: territoryIds
                },
                isActive: true
            },
            select: {
                id: true,
                name: true,
                address: true,
                city: true,
                state: true,
                pincode: true
            }
        });

        if (hospitals.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No hospitals found in user territories',
                data: []
            });
        }

        // Extract hospital IDs
        const hospitalIds = hospitals.map((h: { id: string }) => h.id);

        // Step 3: Get all doctors associated with these hospitals
        const doctorAssociations = await tenantDb.doctorHospitalAssociation.findMany({
            where: {
                hospitalId: {
                    in: hospitalIds
                },
                // Only active associations (no end date or end date in future)
                OR: [
                    { associationEndDate: null },
                    { associationEndDate: { gte: new Date() } }
                ]
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true,
                        email: true,
                        phone: true,
                        isActive: true
                    }
                },
                hospital: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true,
                        state: true,
                        pincode: true
                    }
                }
            }
        });

        // Filter out inactive doctors and format the response
        const doctorList = doctorAssociations
            .filter((assoc: any) => assoc.doctor.isActive)
            .map((assoc: any) => ({
                doctorId: assoc.doctor.id,
                doctorName: assoc.doctor.name,
                specialization: assoc.doctor.specialization || 'Not Specified',
                email: assoc.doctor.email,
                phone: assoc.doctor.phone,
                hospitalName: assoc.hospital.name,
                hospitalAddress: assoc.hospital,
                department: assoc.department,
                position: assoc.position,
                isPrimaryHospital: assoc.isPrimary
            }));

        // Remove duplicate doctors if they're associated with multiple hospitals
        // Group by doctor ID to show all hospital associations
        const doctorsWithHospitals = groupDoctorsByHospitals(doctorList);

        return res.status(200).json({
            success: true,
            message: 'Doctors list retrieved successfully',
            data: doctorsWithHospitals
        });

    } catch (error: any) {
        console.error('Error in getDoctorList:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve doctors list',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Helper function to format address
// const formatAddress = (hospital: any): string => {
//     const parts = [
//         hospital.address,
//         hospital.city,
//         hospital.state,
//         hospital.pincode
//     ].filter(Boolean);

//     return parts.join(', ');
// };



// Helper function to group doctors with their hospital associations
const groupDoctorsByHospitals = (doctorList: any[]): any[] => {
    const doctorMap = new Map();

    doctorList.forEach(item => {
        if (!doctorMap.has(item.doctorId)) {
            doctorMap.set(item.doctorId, {
                doctorId: item.doctorId,
                doctorName: item.doctorName,
                specialization: item.specialization,
                email: item.email,
                phone: item.phone,
                hospitals: []
            });
        }

        doctorMap.get(item.doctorId).hospitals.push({
            hospitalName: item.hospitalName,
            hospitalAddress: item.hospitalAddress,
            department: item.department,
            position: item.position,
            isPrimary: item.isPrimaryHospital
        });
    });

    return Array.from(doctorMap.values());
};

// Doctor Details Controllers


export const getDoctorDetails = async (req: Request, res: Response) => {
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

        // Fetch doctor details with all related information
        const doctor = await tenantDb.doctor.findFirst({
            where: {
                id: doctorId,
                isActive: true // Assuming you want only active doctors
            },
            select: {
                id: true,
                organizationId: true,
                name: true,
                designation: true,
                specialization: true,
                email: true,
                phone: true,
                description: true,
                qualification: true,
                experienceYears: true,
            }
        });

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found or is not active'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Doctor details fetched successfully',
            doctor
        });

    } catch (error: any) {
        console.error('Error fetching doctor details:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching doctor details',
            error: error.message
        });
    }
};