import { PrismaClient } from '../../generated/prisma-tenant/index.js';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                organizationId: string;
                organizationName?: string;
                role: string;
                employeeId: string;
            };
            tenantDb?: PrismaClient;
        }
    }
}

export { };