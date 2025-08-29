import { Request, Response } from 'express';

// Helper function - should be outside the controller
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// ChemistNote Controllers

// Create a new chemist note
export const createChemistNote = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const { chemistId, content } = req.body;
        const createdById = req.user?.id; // Assuming user info is attached to request

        // Validation
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        if (!chemistId || !content) {
            return res.status(400).json({
                success: false,
                message: 'Chemist ID and content are required'
            });
        }

        if (!createdById) {
            return res.status(401).json({
                success: false,
                message: 'User authentication required'
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
        const note = await tenantDb.chemistNote.create({
            data: {
                chemistId,
                createdById,
                content: content.trim()
            },
            include: {
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
                        email: true,
                        role: true
                    }
                }
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Chemist note created successfully',
            note
        });

    } catch (error: any) {
        console.error('Error creating chemist note:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while creating the note',
            error: error.message
        });
    }
};

// Get all notes for a specific chemist
export const getNotesForChemist = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const chemistId = req.params.chemistId;
        const { searchTerm, startDate, endDate, page = 1, limit = 10 } = req.query;

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

        // Build where clause
        const where: any = { chemistId };

        // Search in content
        if (searchTerm) {
            where.content = {
                contains: searchTerm as string,
                mode: 'insensitive'
            };
        }

        // Date range filter
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }

        // Calculate pagination
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        // Get total count
        const totalCount = await tenantDb.chemistNote.count({ where });

        // Fetch notes for the chemist
        const notes = await tenantDb.chemistNote.findMany({
            where,
            skip,
            take,
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        role: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Chemist notes fetched successfully',
            data: {
                chemist: chemistExists,
                notes,
                pagination: {
                    total: totalCount,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(totalCount / Number(limit))
                }
            }
        });

    } catch (error: any) {
        console.error('Error fetching chemist notes:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching chemist notes',
            error: error.message
        });
    }
};

// Get all notes created by a specific employee for chemists
export const getChemistNotesByEmployee = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        const employeeId = req.params.employeeId;
        const { chemistId, page = 1, limit = 10 } = req.query;

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
        if (chemistId) where.chemistId = chemistId;

        // Calculate pagination
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        // Get total count
        const totalCount = await tenantDb.chemistNote.count({ where });

        // Fetch notes created by the employee
        const notes = await tenantDb.chemistNote.findMany({
            where,
            skip,
            take,
            include: {
                chemist: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Employee chemist notes fetched successfully',
            data: {
                employee: employeeExists,
                notes,
                pagination: {
                    total: totalCount,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(totalCount / Number(limit))
                }
            }
        });

    } catch (error: any) {
        console.error('Error fetching employee chemist notes:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching employee chemist notes',
            error: error.message
        });
    }
};

// Update a chemist note
export const updateChemistNote = async (req: Request, res: Response) => {
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
        const existingNote = await tenantDb.chemistNote.findUnique({
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
        const updatedNote = await tenantDb.chemistNote.update({
            where: { id: noteId },
            data: {
                content: content.trim()
            },
            include: {
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
                        email: true,
                        role: true
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

// Delete a chemist note
export const deleteChemistNote = async (req: Request, res: Response) => {
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
        const note = await tenantDb.chemistNote.findUnique({
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
        await tenantDb.chemistNote.delete({
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