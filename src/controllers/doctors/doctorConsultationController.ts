import { Request, Response } from 'express';

// Helper function - should be outside the controller
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};


// DoctorConsultationSchedule Controllers 

// Create a new doctor consultation schedule
export const createDoctorConsultationSchedule = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const {
            doctorId,
            hospitalId,
            dayOfWeek,
            startTime,
            endTime,
            consultationType,
            isActive,
            effectiveFrom,
            effectiveTo
        } = req.body;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!doctorId || !hospitalId || !dayOfWeek || !startTime || !endTime || !consultationType) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID, Hospital ID, day of week, start time, end time, and consultation type are required'
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

        // Check if doctor is associated with the hospital
        const doctorHospitalAssociation = await tenantDb.doctorHospitalAssociation.findUnique({
            where: {
                doctorId_hospitalId: {
                    doctorId,
                    hospitalId
                }
            }
        });

        if (!doctorHospitalAssociation) {
            return res.status(400).json({
                success: false,
                message: 'Doctor is not associated with this hospital'
            });
        }

        // Check for overlapping schedules
        const overlappingSchedule = await tenantDb.doctorConsultationSchedule.findFirst({
            where: {
                doctorId,
                hospitalId,
                dayOfWeek,
                consultationType,
                isActive: true,
                OR: [
                    {
                        AND: [
                            { startTime: { lte: startTime } },
                            { endTime: { gt: startTime } }
                        ]
                    },
                    {
                        AND: [
                            { startTime: { lt: endTime } },
                            { endTime: { gte: endTime } }
                        ]
                    },
                    {
                        AND: [
                            { startTime: { gte: startTime } },
                            { endTime: { lte: endTime } }
                        ]
                    }
                ]
            }
        });

        if (overlappingSchedule) {
            return res.status(409).json({
                success: false,
                message: 'Schedule overlaps with an existing schedule for this doctor'
            });
        }

        // Create the schedule
        const schedule = await tenantDb.doctorConsultationSchedule.create({
            data: {
                doctorId,
                hospitalId,
                dayOfWeek,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                consultationType,
                isActive: isActive !== undefined ? isActive : true,
                effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
                effectiveTo: effectiveTo ? new Date(effectiveTo) : null
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

        return res.status(201).json({
            success: true,
            message: 'Doctor consultation schedule created successfully',
            schedule
        });

    } catch (error: any) {
        console.error('Error creating doctor consultation schedule:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while creating the schedule',
            error: error.message
        });
    }
};


// Get all schedules for a specific doctor
export const getDoctorSchedules = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const doctorId = req.params.doctorId;
        const { hospitalId, isActive } = req.query;

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

        // Build where clause
        const where: any = { doctorId };
        if (hospitalId) where.hospitalId = hospitalId;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        // Fetch all schedules for the doctor
        const schedules = await tenantDb.doctorConsultationSchedule.findMany({
            where,
            include: {
                hospital: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true
                    }
                }
            },
            orderBy: [
                { hospitalId: 'asc' },
                { dayOfWeek: 'asc' },
                { startTime: 'asc' }
            ]
        });

        // Group schedules by hospital
        const schedulesByHospital = schedules.reduce((acc: any, schedule: any) => {
            const hospitalId = schedule.hospital.id;
            if (!acc[hospitalId]) {
                acc[hospitalId] = {
                    hospital: schedule.hospital,
                    schedules: []
                };
            }
            acc[hospitalId].schedules.push(schedule);
            return acc;
        }, {});

        return res.status(200).json({
            success: true,
            message: 'Doctor schedules fetched successfully',
            data: {
                doctor: doctorExists,
                schedulesByHospital: Object.values(schedulesByHospital)
            }
        });

    } catch (error: any) {
        console.error('Error fetching doctor schedules:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching doctor schedules',
            error: error.message
        });
    }
};


// Update a doctor consultation schedule
export const updateDoctorConsultationSchedule = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const scheduleId = req.params.scheduleId;
        const {
            dayOfWeek,
            startTime,
            endTime,
            consultationType,
            isActive,
            effectiveFrom,
            effectiveTo
        } = req.body;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!scheduleId) {
            return res.status(400).json({
                success: false,
                message: 'Schedule ID is required'
            });
        }

        // Check if schedule exists
        const existingSchedule = await tenantDb.doctorConsultationSchedule.findUnique({
            where: { id: scheduleId }
        });

        if (!existingSchedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        // If updating time or day, check for overlaps
        if (dayOfWeek || startTime || endTime) {
            const checkDayOfWeek = dayOfWeek || existingSchedule.dayOfWeek;
            const checkStartTime = startTime ? new Date(startTime) : existingSchedule.startTime;
            const checkEndTime = endTime ? new Date(endTime) : existingSchedule.endTime;
            const checkConsultationType = consultationType || existingSchedule.consultationType;

            const overlappingSchedule = await tenantDb.doctorConsultationSchedule.findFirst({
                where: {
                    doctorId: existingSchedule.doctorId,
                    hospitalId: existingSchedule.hospitalId,
                    dayOfWeek: checkDayOfWeek,
                    consultationType: checkConsultationType,
                    isActive: true,
                    NOT: { id: scheduleId },
                    OR: [
                        {
                            AND: [
                                { startTime: { lte: checkStartTime } },
                                { endTime: { gt: checkStartTime } }
                            ]
                        },
                        {
                            AND: [
                                { startTime: { lt: checkEndTime } },
                                { endTime: { gte: checkEndTime } }
                            ]
                        },
                        {
                            AND: [
                                { startTime: { gte: checkStartTime } },
                                { endTime: { lte: checkEndTime } }
                            ]
                        }
                    ]
                }
            });

            if (overlappingSchedule) {
                return res.status(409).json({
                    success: false,
                    message: 'Updated schedule would overlap with an existing schedule'
                });
            }
        }

        // Update the schedule
        const updatedSchedule = await tenantDb.doctorConsultationSchedule.update({
            where: { id: scheduleId },
            data: {
                dayOfWeek,
                startTime: startTime ? new Date(startTime) : undefined,
                endTime: endTime ? new Date(endTime) : undefined,
                consultationType,
                isActive,
                effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
                effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined
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
            message: 'Schedule updated successfully',
            schedule: updatedSchedule
        });

    } catch (error: any) {
        console.error('Error updating schedule:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the schedule',
            error: error.message
        });
    }
};

// Delete a doctor consultation schedule
export const deleteDoctorConsultationSchedule = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const scheduleId = req.params.scheduleId;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!scheduleId) {
            return res.status(400).json({
                success: false,
                message: 'Schedule ID is required'
            });
        }

        // Check if schedule exists
        const schedule = await tenantDb.doctorConsultationSchedule.findUnique({
            where: { id: scheduleId }
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        // Delete the schedule
        await tenantDb.doctorConsultationSchedule.delete({
            where: { id: scheduleId }
        });

        return res.status(200).json({
            success: true,
            message: 'Schedule deleted successfully'
        });

    } catch (error: any) {
        console.error('Error deleting schedule:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the schedule',
            error: error.message
        });
    }
};

// Toggle schedule active status
export const toggleScheduleStatus = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const scheduleId = req.params.scheduleId;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!scheduleId) {
            return res.status(400).json({
                success: false,
                message: 'Schedule ID is required'
            });
        }

        // Check if schedule exists
        const schedule = await tenantDb.doctorConsultationSchedule.findUnique({
            where: { id: scheduleId }
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        // Toggle the active status
        const updatedSchedule = await tenantDb.doctorConsultationSchedule.update({
            where: { id: scheduleId },
            data: {
                isActive: !schedule.isActive
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
            message: `Schedule ${updatedSchedule.isActive ? 'activated' : 'deactivated'} successfully`,
            schedule: updatedSchedule
        });

    } catch (error: any) {
        console.error('Error toggling schedule status:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while toggling schedule status',
            error: error.message
        });
    }
};