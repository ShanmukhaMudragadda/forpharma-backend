import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import SchemaManagementService from '../services/SchemaManagementService.js';

const schemaService = SchemaManagementService.getInstance();


export const createUserInShared = async (req: Request, res: Response) => {
    try {
        const { org_id, email, password } = req.body;

        // Input validation
        if (!org_id || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID, email, and password are required'
            });
        }

        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if user already exists
        const existingUser = await schemaService.sharedDb.user.findUnique({
            where: { email: email }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Create admin user
        const adminUser = await schemaService.sharedDb.user.create({
            data: {
                email: email,
                password: hashedPassword, // Use hashed password
                role: 'SYSTEM_ADMINISTRATOR',
                organizationId: org_id,
                isActive: true
            }
        });

        console.log(`Admin user "${adminUser.email}" created successfully in shared schema`);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                id: adminUser.id,
                email: adminUser.email,
                role: adminUser.role,
                organizationId: adminUser.organizationId
            }
        });

    } catch (error: any) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

