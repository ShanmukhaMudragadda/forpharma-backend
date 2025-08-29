import { Request, Response } from 'express';

// Helper function - should be outside the controller
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};


// DoctorNote controllers
// Create a new doctor note
export const createDoctorNote = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const { doctorId, content } = req.body;
        const createdById = req.user?.id; // Assuming user info is attached to request

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!doctorId || !content) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID and content are required'
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

        // Check if employee (creator) exists
        const employeeExists = await tenantDb.employee.findUnique({
            where: { id: createdById }
        });

        if (!employeeExists) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Create the note
        const note = await tenantDb.doctorNote.create({
            data: {
                doctorId,
                createdById,
                content: content.trim()
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true
                    }
                }
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Doctor note created successfully',
            note
        });

    } catch (error: any) {
        console.error('Error creating doctor note:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while creating the note',
            error: error.message
        });
    }
};



// Get all notes for a specific doctor
export const getNotesForDoctor = async (req: Request, res: Response) => {
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
                specialization: true,
                designation: true
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

        // Fetch notes for the doctor
        const notes = await tenantDb.doctorNote.findMany({
            where,
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Doctor notes fetched successfully',
            data: {
                doctor: doctorExists,
                notes,
            }
        });

    } catch (error: any) {
        console.error('Error fetching doctor notes:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching doctor notes',
            error: error.message
        });
    }
};

// Get all notes created by a specific employee
export const getNotesByEmployee = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const employeeId = req.params.employeeId;

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        // Check if employee exists
        const employeeExists = await tenantDb.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                email: true,
                role: true
            }
        });

        if (!employeeExists) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Build where clause
        const where: any = { createdById: employeeId };

        // Fetch notes created by the employee
        const notes = await tenantDb.doctorNote.findMany({
            where,
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true,
                        designation: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Employee notes fetched successfully',
            data: {
                employee: employeeExists,
                notes,
            }
        });

    } catch (error: any) {
        console.error('Error fetching employee notes:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching employee notes',
            error: error.message
        });
    }
};

// Update a doctor note
export const updateDoctorNote = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const noteId = req.params.noteId;
        const { content } = req.body;
        const userId = req.user?.id; // Current user making the update

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!noteId) {
            return res.status(400).json({
                success: false,
                message: 'Note ID is required'
            });
        }

        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Content is required'
            });
        }

        // Check if note exists
        const existingNote = await tenantDb.doctorNote.findUnique({
            where: { id: noteId }
        });

        if (!existingNote) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Check if user has permission to update (only creator can update)
        if (existingNote.createdById !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to update this note'
            });
        }

        // Update the note
        const updatedNote = await tenantDb.doctorNote.update({
            where: { id: noteId },
            data: {
                content: content.trim()
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Note updated successfully',
            note: updatedNote
        });

    } catch (error: any) {
        console.error('Error updating note:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the note',
            error: error.message
        });
    }
};

// Delete a doctor note
export const deleteDoctorNote = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const noteId = req.params.noteId;
        const userId = req.user?.id; // Current user making the request
        const userRole = req.user?.role; // Assuming role is available

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!noteId) {
            return res.status(400).json({
                success: false,
                message: 'Note ID is required'
            });
        }

        // Check if note exists
        const note = await tenantDb.doctorNote.findUnique({
            where: { id: noteId }
        });

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Check permission (only creator or admin can delete)
        if (note.createdById !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this note'
            });
        }

        // Delete the note
        await tenantDb.doctorNote.delete({
            where: { id: noteId }
        });

        return res.status(200).json({
            success: true,
            message: 'Note deleted successfully'
        });

    } catch (error: any) {
        console.error('Error deleting note:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the note',
            error: error.message
        });
    }
};