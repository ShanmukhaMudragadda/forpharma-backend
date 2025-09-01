import SchemaManagementService from '../services/SchemaManagementService.js';
import { PrismaClient as SharedPrismaClient } from '../../generated/prisma-shared/index.js';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const schemaService = SchemaManagementService.getInstance();

async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract token
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token and get payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Extract email from token
    const userEmail = decoded.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'No email found in token' });
    }

    // Look up user in shared database to get organization ID
    const employeeWithOrg = await schemaService.sharedDb.user.findUnique({
      where: {
        email: userEmail
      },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            schemaName: true,
            isActive: true
          }
        }
      }
    });

    if (!employeeWithOrg) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!employeeWithOrg.organizationId) {
      return res.status(400).json({ error: 'User not associated with any organization' });
    }

    // Check if organization is active
    if (!employeeWithOrg.organization?.isActive) {
      return res.status(403).json({ error: 'Organization is not active' });
    }

    // Check if organization has a schema
    if (!employeeWithOrg.organization?.schemaName) {
      return res.status(500).json({ error: 'Organization schema not configured' });
    }

    // Add user info and organization details to request
    const schemaName = employeeWithOrg.organization?.schemaName;
    console.log(schemaName);

    const tenantDb = await schemaService.getTenantClient(schemaName);
    req.tenantDb = tenantDb;
    const emp_user = await tenantDb.employee.findUnique({
      where: {
        email: userEmail
      },
      select: {
        id: true
      }
    })

    req.user = {
      ...decoded,
      id: emp_user?.id,
      email: employeeWithOrg.email,
      employeeId: employeeWithOrg.id,
      organizationId: employeeWithOrg.organizationId,
      organizationName: employeeWithOrg.organization.name,
      role: employeeWithOrg.role,
    };

    // Get tenant database connection using organizationId



    console.log("middleware completes")
    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    res.status(500).json({ error: 'Failed to establish tenant connection' });
  }
}

// Optional: Add cleanup function for graceful shutdown
export async function cleanupMiddleware() {
  await schemaService.sharedDb.$disconnect();
  await schemaService.closeAllConnections();
}

export default tenantMiddleware;