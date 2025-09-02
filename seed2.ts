import { PrismaClient as SharedPrismaClient } from './generated/prisma-shared/index.js';
import { PrismaClient as TenantPrismaClient } from './generated/prisma-tenant/index.js';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

// Environment-aware Prisma client initialization
const getDatabaseUrl = (type: 'shared' | 'tenant') => {
    const baseUrl = process.env.DATABASE_URL;

    if (type === 'tenant') {
        // Append schema parameter for tenant
        return `${baseUrl}?schema=org_forsys_inc_1756708273231`;
    } else {
        // Use public schema for shared
        return `${baseUrl}?schema=public`;
    }
};

// Initialize Prisma clients with production-safe configuration
const sharedPrisma = new SharedPrismaClient({
    datasources: {
        db: {
            url: getDatabaseUrl('shared')
        }
    }
});

const tenantPrisma = new TenantPrismaClient({
    datasources: {
        db: {
            url: getDatabaseUrl('tenant')
        }
    }
});

// Helper functions
const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
};

const getRandomElement = <T>(array: T[]): T => {
    return array[Math.floor(Math.random() * array.length)];
};

const getRandomElements = <T>(array: T[], count: number): T[] => {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

// Constants
const ADMIN_EMAIL = 'ravi@gamil.com';
const ADMIN_PASSWORD = '$2b$10$s14jFp7CSdmB4g9jAnO.3ed.Um040Ge0lS4lXstzy2NEpWn1fZZ7K@123';
const ORGANIZATION_ID = 'f90a6707-e537-4174-abab-1a232afc2a13';

// Generate Indian cities and states
const indianCities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad'];
const indianStates = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'West Bengal', 'Telangana', 'Gujarat', 'Rajasthan'];

// Medical specializations
const specializations = [
    'General Physician', 'Cardiologist', 'Neurologist', 'Pediatrician',
    'Orthopedic', 'Dermatologist', 'Gynecologist', 'Psychiatrist'
];

// Hospital types
const hospitalTypes = ['Government', 'Private', 'Multi-Specialty', 'Clinic', 'Nursing Home'];


async function seedTenantDatabase() {
    console.log('\n🌱 Seeding tenant database...');

    const adminEmployee = await tenantPrisma.employee.create({
        data: {
            organizationId: ORGANIZATION_ID,
            email: 'ravi@gmail.com',
            passwordHash: ADMIN_PASSWORD,
            firstName: 'Ravi',
            lastName: 'Kumar',
            phone: '+91-9876543210',
            role: 'SYSTEM_ADMINISTRATOR',
            employeeCode: 'EMP001',
            city: 'Jaipur',
            state: 'Rajasthan',
            isActive: true
        }
    });

    // Step 2: Create territories (hierarchical structure)
    console.log('\n📍 Creating territories...');

    // Create region
    const westRegion = await tenantPrisma.territory.create({
        data: {
            organizationId: ORGANIZATION_ID,
            name: 'North Region',
            type: 'region'
        }
    });

    // Assign territory to admin
    await tenantPrisma.employeeTerritory.create({
        data: {
            employeeId: adminEmployee.id,
            territoryId: westRegion.id,
            assignedAt: new Date(),
            isPrimary: true
        }
    });

    console.log('✅ Territories created and assigned');

    // Step 3: Create additional employees for testing
    console.log('\n👥 Creating additional employees...');


    // Step 4: Create hospital chains
    console.log('\n🏥 Creating hospital chains...');

    const hospitalChain = await tenantPrisma.hospitalChain.create({
        data: {
            organizationId: ORGANIZATION_ID,
            name: 'Apollo Hospital',
            headquartersAddress: 'Chennai, Tamil Nadu',
            contactEmail: 'info@apollohospitals.com',
            contactPhone: '+91-44-12345678',
            isActive: true
        }
    });

    // Step 5: Create hospitals
    console.log('\n🏥 Creating hospitals...');

    const hospitals: any[] = [];
    const hospitalData = [
        { name: 'Apollo Hospital Mumbaii', chainId: hospitalChain.id, city: 'Mumbai' },
        { name: 'City Generall Hospital', chainId: null, city: 'Mumbai' },
        { name: 'Apollo Hospital Punee', chainId: hospitalChain.id, city: 'Pune' },
        { name: 'Ruby Hall Clinicc', chainId: null, city: 'Pune' }
    ];

    for (const hosp of hospitalData) {
        const hospital = await tenantPrisma.hospital.create({
            data: {
                organizationId: ORGANIZATION_ID,
                name: hosp.name,
                type: getRandomElement(hospitalTypes),
                address: faker.location.streetAddress(),
                city: hosp.city,
                state: 'Maharashtra',
                pincode: faker.location.zipCode('######'),
                latitude: hosp.city === 'Mumbai' ? 19.0760 : 18.5204,
                longitude: hosp.city === 'Mumbai' ? 72.8777 : 73.8567,
                phone: '+911234567890',
                email: faker.internet.email(),
                hospitalChainId: hosp.chainId,
                territoryId: westRegion.id,
                isActive: true
            }
        });
        hospitals.push(hospital);
    }
    console.log(`✅ Created ${hospitals.length} hospitals`);

    // Step 6: Create doctors
    console.log('\n👨‍⚕️ Creating doctors...');

    const doctors: any[] = [];
    for (let i = 0; i < 10; i++) {
        const doctor = await tenantPrisma.doctor.create({
            data: {
                organizationId: ORGANIZATION_ID,
                name: `Dr. ${faker.person.firstName()} ${faker.person.lastName()}`,
                designation: faker.helpers.arrayElement(['Senior Consultant', 'Consultant', 'Junior Consultant']),
                specialization: getRandomElement(specializations),
                email: faker.internet.email(),
                phone: '+911234567890',
                qualification: faker.helpers.arrayElement(['MBBS, MD', 'MBBS, MS', 'MBBS, DM']),
                experienceYears: faker.number.int({ min: 2, max: 20 }),
                description: faker.lorem.sentence(),
                createdById: adminEmployee.id,
                isActive: true
            }
        });
        doctors.push(doctor);

        // Create hospital associations
        const associatedHospitals = getRandomElements(hospitals, faker.number.int({ min: 1, max: 2 }));
        for (let j = 0; j < associatedHospitals.length; j++) {
            await tenantPrisma.doctorHospitalAssociation.create({
                data: {
                    doctorId: doctor.id,
                    hospitalId: associatedHospitals[j].id,
                    department: doctor.specialization,
                    position: doctor.designation,
                    isPrimary: j === 0,
                    associationStartDate: faker.date.past()
                }
            });

            // Create consultation schedules
            const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
            const selectedDays = getRandomElements(daysOfWeek, 3);

            for (const day of selectedDays) {
                await tenantPrisma.doctorConsultationSchedule.create({
                    data: {
                        doctorId: doctor.id,
                        hospitalId: associatedHospitals[j].id,
                        dayOfWeek: day as any,
                        startTime: new Date(`2024-01-01T10:00:00`),
                        endTime: new Date(`2024-01-01T13:00:00`),
                        consultationType: 'OPD',
                        isActive: true
                    }
                });
            }
        }
    }
    console.log(`✅ Created ${doctors.length} doctors with associations and schedules`);

    // Step 7: Create chemist chain
    console.log('\n💊 Creating chemist chains...');

    const chemistChain = await tenantPrisma.chemistChain.create({
        data: {
            organizationId: ORGANIZATION_ID,
            name: 'MedPlus',
            headquartersAddress: 'Hyderabad, Telangana',
            contactEmail: 'info@medplus.com',
            contactPhone: '+91-40-12345678',
            isActive: true
        }
    });

    // Step 8: Create chemists
    console.log('\n💊 Creating chemists...');

    const chemists: any[] = [];
    const chemistData = [
        { name: 'MedPlus Andheri', chainId: chemistChain.id, city: 'Mumbai' },
        { name: 'Wellness Forever', chainId: null, city: 'Mumbai' },
        { name: 'MedPlus Pune', chainId: chemistChain.id, city: 'Pune' },
        { name: 'Noble Medical Stores', chainId: null, city: 'Pune' }
    ];

    for (const chem of chemistData) {
        const chemist = await tenantPrisma.chemist.create({
            data: {
                organizationId: ORGANIZATION_ID,
                name: chem.name,
                type: faker.helpers.arrayElement(['CHEMIST', 'STOCKIST']) as any,
                email: faker.internet.email(),
                phone: '+911234567890',
                address: faker.location.streetAddress(),
                city: chem.city,
                state: 'Maharashtra',
                pincode: faker.location.zipCode('######'),
                latitude: chem.city === 'Mumbai' ? 19.0760 : 18.5204,
                longitude: chem.city === 'Mumbai' ? 72.8777 : 73.8567,
                visitingHours: '9:00 AM - 9:00 PM',
                chemistChainId: chem.chainId,
                territoryId: westRegion.id,
                createdById: adminEmployee.id,
                isActive: true
            }
        });
        chemists.push(chemist);
    }
    console.log(`✅ Created ${chemists.length} chemists`);

    // Step 9: Create doctor-chemist relations
    console.log('\n🔗 Creating doctor-chemist relations...');

    let relationCount = 0;
    for (const doctor of doctors.slice(0, 5)) {
        const nearbyChemists = getRandomElements(chemists, 2);
        for (const chemist of nearbyChemists) {
            await tenantPrisma.doctorChemistRelation.create({
                data: {
                    doctorId: doctor.id,
                    chemistId: chemist.id,
                    createdById: adminEmployee.id
                }
            });
            relationCount++;
        }
    }
    console.log(`✅ Created ${relationCount} doctor-chemist relations`);

    // Step 10: Create doctor notes
    console.log('\n📝 Creating doctor notes...');

    let noteCount = 0;
    for (const doctor of doctors.slice(0, 5)) {
        for (let i = 0; i < 2; i++) {
            await tenantPrisma.doctorNote.create({
                data: {
                    doctorId: doctor.id,
                    createdById: getRandomElement([adminEmployee.id, adminEmployee.id]),
                    content: faker.lorem.paragraph()
                }
            });
            noteCount++;
        }
    }
    console.log(`✅ Created ${noteCount} doctor notes`);

    // Step 11: Create chemist notes
    console.log('\n📝 Creating chemist notes...');

    noteCount = 0;
    for (const chemist of chemists) {
        await tenantPrisma.chemistNote.create({
            data: {
                chemistId: chemist.id,
                createdById: getRandomElement([adminEmployee.id, adminEmployee.id]),
                content: faker.lorem.paragraph()
            }
        });
        noteCount++;
    }
    console.log(`✅ Created ${noteCount} chemist notes`);

    // Step 12: Create doctor interactions
    console.log('\n🤝 Creating doctor interactions...');

    let interactionCount = 0;
    for (const doctor of doctors.slice(0, 5)) {
        const hospital = await tenantPrisma.doctorHospitalAssociation.findFirst({
            where: { doctorId: doctor.id },
            include: { hospital: true }
        });

        if (hospital) {
            await tenantPrisma.doctorInteraction.create({
                data: {
                    doctorId: doctor.id,
                    employeeId: getRandomElement([adminEmployee.id, adminEmployee.id]),
                    hospitalId: hospital.hospitalId,
                    interactionType: faker.helpers.arrayElement(['MEETING', 'CALL']) as any,
                    startTime: faker.date.recent(),
                    endTime: faker.date.recent(),
                    purpose: 'Product discussion',
                    outcome: 'Positive response',
                    rating: faker.number.int({ min: 3, max: 5 })
                }
            });
            interactionCount++;
        }
    }
    console.log(`✅ Created ${interactionCount} doctor interactions`);

    // Step 13: Create chemist interactions
    console.log('\n🤝 Creating chemist interactions...');

    interactionCount = 0;
    for (const chemist of chemists) {
        await tenantPrisma.chemistInteraction.create({
            data: {
                chemistId: chemist.id,
                employeeId: getRandomElement([adminEmployee.id, adminEmployee.id]),
                interactionType: 'MEETING',
                startTime: faker.date.recent(),
                endTime: faker.date.recent(),
                purpose: 'Order discussion',
                outcome: 'Order placed',
                rating: faker.number.int({ min: 3, max: 5 })
            }
        });
        interactionCount++;
    }
    console.log(`✅ Created ${interactionCount} chemist interactions`);

    console.log('\n✨ Tenant database seeding completed!');

    // Return summary
    return {
        employees: {
            admin: adminEmployee,
        },
        territories: {
            region: westRegion,
        },
        hospitals,
        doctors,
        chemists
    };
}

async function main() {
    try {
        console.log('🚀 Starting database seeding...\n');
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Force seed: ${process.env.FORCE_SEED || 'false'}\n`);


        // Run migrations to ensure schema is up to date
        console.log('🔄 Ensuring database schema is up to date...');
        try {
            // Note: In production, migrations should be run separately
            // This is just a safety check
            console.log('ℹ️  Skipping migration check in seed script (run separately)');
        } catch (error) {
            console.log('⚠️  Migration check skipped:', error);
        }

        // Seed databases
        // const { hashedPassword } = await seedSharedDatabase();
        const tenantData = await seedTenantDatabase();

        // Print summary
        console.log('\n📊 SEEDING SUMMARY');
        console.log('==================');
        console.log('✅ Shared Database:');
        console.log('   - 1 Organization (MediCare Pharmaceuticals)');
        console.log('   - 1 Admin User');
        console.log('\n✅ Tenant Database:');
        console.log('   - 4 Employees (1 Admin, 1 Sales Manager, 2 MRs)');
        console.log('   - 4 Territories (1 Region, 1 State, 2 Cities)');
        console.log(`   - ${tenantData.hospitals.length} Hospitals`);
        console.log(`   - ${tenantData.doctors.length} Doctors`);
        console.log(`   - ${tenantData.chemists.length} Chemists`);
        console.log('   - Doctor-Hospital associations with schedules');
        console.log('   - Doctor-Chemist relations');
        console.log('   - Doctor and Chemist notes');
        console.log('   - Doctor and Chemist interactions');

        console.log('\n🔐 TEST CREDENTIALS');
        console.log('===================');
        console.log('Admin User:');
        console.log(`   Email: ${ADMIN_EMAIL}`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);
        console.log('\nSales Manager:');
        console.log('   Email: sales.manager@medicarepharma.com');
        console.log('   Password: Manager@123');
        console.log('\nMedical Representatives:');
        console.log('   Email: amit.patel@medicarepharma.com');
        console.log('   Password: MR@123456');
        console.log('   Email: priya.shah@medicarepharma.com');
        console.log('   Password: MR@123456');

        console.log('\n✅ Database seeding completed successfully!');
        console.log('🎉 Your Heroku database is now populated with test data!');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    } finally {
        await sharedPrisma.$disconnect();
        await tenantPrisma.$disconnect();
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, cleaning up...');
    await sharedPrisma.$disconnect();
    await tenantPrisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, cleaning up...');
    await sharedPrisma.$disconnect();
    await tenantPrisma.$disconnect();
    process.exit(0);
});

// Run the seeding
if (require.main === module) {
    main()
        .catch((e) => {
            console.error('💥 Fatal error during seeding:', e);
            process.exit(1);
        });
}

export { main as seedDatabase };