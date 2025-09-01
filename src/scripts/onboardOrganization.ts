import SchemaManagementService from '../services/SchemaManagementService.js';
import bcrypt from 'bcrypt';

interface OrganizationData {
  name: string;
  email: string; // Contact email for the organization
  address?: string;
  website?: string;
  adminEmail: string; // Admin user's email
  adminPassword: string;
  adminFirstName: string;
  adminLastName?: string;
}

/**
 * Onboards a new organization by creating its record, schema, and initial admin user.
 * @param organizationData Data for the new organization and its admin user.
 * @returns An object containing the new organization's ID, schema name, and admin user ID.
 */
export async function onboardNewOrganization(organizationData: OrganizationData) {

  try {
    console.log('Starting organization onboarding process...');

    // 1. Create the organization record in the shared database schema
    const schemaService = SchemaManagementService.getInstance();
    const org = await schemaService.sharedDb.organization.create({
      data: {
        name: organizationData.name,
        contactEmail: organizationData.email,
        address: organizationData.address,
        website: organizationData.website
      }
    });

    console.log(`Organization record created with ID: ${org.id}`);

    // 2. Create the dedicated PostgreSQL schema for the organization and run its initial migrations
    // This internally uses the loaded migration files from schemaService.initializeMigrations()
    const schemaName = await schemaService.createOrganizationSchema(
      org.id,
      organizationData.name
    );

    console.log(`Dedicated schema "${schemaName}" created and initialized for organization ID: ${org.id}`);

    // 3. Create the initial admin user record in the shared database schema
    // The admin user is linked to the organization via organizationId.
    const hashedPassword = await bcrypt.hash(organizationData.adminPassword, 10);

    const adminUser = await schemaService.sharedDb.user.create({
      data: {
        email: organizationData.adminEmail,
        password: hashedPassword,
        role: 'SYSTEM_ADMINISTRATOR',
        organizationId: org.id,
        isActive: true
      }
    });

    console.log(`Admin user "${adminUser.email}" created successfully in shared schema for organization: ${org.name}`);

    const tenantDb = await schemaService.getTenantClient(schemaName);
    const adminEmployee = await tenantDb.employee.create({
      data: {
        organizationId: org.id,
        email: organizationData.adminEmail,
        passwordHash: hashedPassword,
        firstName: organizationData.adminFirstName,
        lastName: organizationData.adminLastName,
        role: 'SYSTEM_ADMINISTRATOR',
        isActive: true,
      }
    });

    console.log(`Admin employee "${adminEmployee.email}" created successfully in tenant schema: ${schemaName}`);


    return {
      success: true,
      organizationId: org.id,
      schemaName: schemaName,
      adminUserId: adminUser.id
    };

  } catch (error) {
    console.error('❌ Onboarding process failed:', error);
    // Re-throw the error so it can be caught by the calling controller
    throw error;
  }
}

export default onboardNewOrganization;