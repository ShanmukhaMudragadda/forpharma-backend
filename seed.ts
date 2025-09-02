import { PrismaClient as SharedPrismaClient } from './generated/prisma-shared/index.js';
import { PrismaClient as TenantPrismaClient } from './generated/prisma-tenant/index.js';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

// Environment-aware Prisma client initialization
const getDatabaseUrl = (type: 'shared' | 'tenant') => {
    if (process.env.NODE_ENV === 'production') {
        // Use Heroku's DATABASE_URL environment variable
        return process.env.DATABASE_URL;
    }
    // Local development URLs
    return type === 'shared'
        ? process.env.SHARED_DATABASE_URL
        : process.env.TENANT_DATABASE_URL;
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
const ADMIN_EMAIL = 'ravi.meena@forsysinc.com';
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

async function checkExistingData() {
    console.log('🔍 Checking for existing data...');

    try {
        const [orgCount, empCount] = await Promise.all([
            sharedPrisma.organization.count(),
            tenantPrisma.employee.count()
        ]);

        if (orgCount > 0 || empCount > 0) {
            console.log('⚠️  Existing data found!');
            console.log(`   - Organizations: ${orgCount}`);
            console.log(`   - Employees: ${empCount}`);

            if (process.env.FORCE_SEED !== 'true') {
                throw new Error('Database already contains data. Set FORCE_SEED=true to override.');
            }
            console.log('🔄 FORCE_SEED enabled, proceeding with data override...');
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('already contains data')) {
            throw error;
        }
        // If tables don't exist or other errors, continue with seeding
        console.log('📝 No existing data found or tables not yet created, proceeding...');
    }
}

async function clearExistingData() {
    if (process.env.FORCE_SEED === 'true') {
        console.log('🧹 Clearing existing data...');

        try {
            // Clear tenant data first (due to foreign key constraints)
            await tenantPrisma.$transaction(async (tx) => {
                await tx.doctorInteraction.deleteMany();
                await tx.chemistInteraction.deleteMany();
                await tx.doctorNote.deleteMany();
                await tx.chemistNote.deleteMany();
                await tx.doctorChemistRelation.deleteMany();
                await tx.doctorConsultationSchedule.deleteMany();
                await tx.doctorHospitalAssociation.deleteMany();
                await tx.employeeTerritory.deleteMany();
                await tx.doctor.deleteMany();
                await tx.chemist.deleteMany();
                await tx.hospital.deleteMany();
                await tx.territory.deleteMany();
                await tx.hospitalChain.deleteMany();
                await tx.chemistChain.deleteMany();
                await tx.employee.deleteMany();
            });

            console.log('✅ Existing data cleared successfully');
        } catch (error) {
            console.error('⚠️  Error clearing data (may be expected if tables are empty):', error);
        }
    }
}


async function seedTenantDatabase() {
    console.log('\n🌱 Seeding tenant database...');

    // Step 1: Create admin employee in tenant schema
    const adminEmployee = await tenantPrisma.employee.create({
        data: {
            organizationId: ORGANIZATION_ID,
            email: ADMIN_EMAIL,
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
    console.log('✅ Admin employee created in tenant database');

    // Step 2: Create territories (hierarchical structure)
    console.log('\n📍 Creating territories...');

    // Create region
    const westRegion = await tenantPrisma.territory.create({
        data: {
            organizationId: ORGANIZATION_ID,
            name: 'West Region',
            type: 'region'
        }
    });

    // Create state
    const maharashtra = await tenantPrisma.territory.create({
        data: {
            organizationId: ORGANIZATION_ID,
            name: 'Maharashtra',
            type: 'state',
            parentTerritoryId: westRegion.id
        }
    });

    // Create cities
    const mumbai = await tenantPrisma.territory.create({
        data: {
            organizationId: ORGANIZATION_ID,
            name: 'Mumbai',
            type: 'city',
            parentTerritoryId: westRegion.id
        }
    });

    const pune = await tenantPrisma.territory.create({
        data: {
            organizationId: ORGANIZATION_ID,
            name: 'Pune',
            type: 'city',
            parentTerritoryId: westRegion.id
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

    // Sales Manager
    const salesManager = await tenantPrisma.employee.create({
        data: {
            organizationId: ORGANIZATION_ID,
            email: 'sales.manager@medicarepharma.com',
            passwordHash: await hashPassword('Manager@123'),
            firstName: 'Rajesh',
            lastName: 'Kumar',
            phone: '+91-9876543211',
            role: 'SALES_MANAGER',
            employeeCode: 'EMP002',
            city: 'Mumbai',
            state: 'Maharashtra',
            reportingManagerId: adminEmployee.id,
            isActive: true
        }
    });

    // Medical Representatives
    const mr1 = await tenantPrisma.employee.create({
        data: {
            organizationId: ORGANIZATION_ID,
            email: 'amit.patel@medicarepharma.com',
            passwordHash: await hashPassword('MR@123456'),
            firstName: 'Amit',
            lastName: 'Patel',
            phone: '+91-9876543212',
            role: 'MEDICAL_REPRESENTATIVE',
            employeeCode: 'EMP003',
            city: 'Mumbai',
            state: 'Maharashtra',
            reportingManagerId: salesManager.id,
            isActive: true
        }
    });

    const mr2 = await tenantPrisma.employee.create({
        data: {
            organizationId: ORGANIZATION_ID,
            email: 'priya.shah@medicarepharma.com',
            passwordHash: await hashPassword('MR@123456'),
            firstName: 'Priya',
            lastName: 'Shah',
            phone: '+91-9876543213',
            role: 'MEDICAL_REPRESENTATIVE',
            employeeCode: 'EMP004',
            city: 'Pune',
            state: 'Maharashtra',
            reportingManagerId: salesManager.id,
            isActive: true
        }
    });

    // Assign territories to employees
    await tenantPrisma.employeeTerritory.createMany({
        data: [
            {
                employeeId: salesManager.id,
                territoryId: westRegion.id,
                assignedAt: new Date(),
                isPrimary: true
            },
            {
                employeeId: mr1.id,
                territoryId: mumbai.id,
                assignedAt: new Date(),
                isPrimary: true
            },
            {
                employeeId: mr2.id,
                territoryId: pune.id,
                assignedAt: new Date(),
                isPrimary: true
            }
        ]
    });

    console.log('✅ Employees created');

    // Step 4: Create hospital chains
    console.log('\n🏥 Creating hospital chains...');

    const hospitalChain = await tenantPrisma.hospitalChain.create({
        data: {
            organizationId: ORGANIZATION_ID,
            name: 'Apollo Hospitals',
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
        { name: 'Apollo Hospital Mumbai', chainId: hospitalChain.id, city: 'Mumbai', territory: mumbai },
        { name: 'City General Hospital', chainId: null, city: 'Mumbai', territory: mumbai },
        { name: 'Apollo Hospital Pune', chainId: hospitalChain.id, city: 'Pune', territory: pune },
        { name: 'Ruby Hall Clinic', chainId: null, city: 'Pune', territory: pune }
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
                territoryId: hosp.territory.id,
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
        { name: 'MedPlus Andheri', chainId: chemistChain.id, city: 'Mumbai', territory: mumbai },
        { name: 'Wellness Forever', chainId: null, city: 'Mumbai', territory: mumbai },
        { name: 'MedPlus Pune', chainId: chemistChain.id, city: 'Pune', territory: pune },
        { name: 'Noble Medical Stores', chainId: null, city: 'Pune', territory: pune }
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
                territoryId: chem.territory.id,
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
                    createdById: getRandomElement([mr1.id, mr2.id]),
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
                createdById: getRandomElement([mr1.id, mr2.id]),
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
                    employeeId: getRandomElement([mr1.id, mr2.id]),
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
                employeeId: getRandomElement([mr1.id, mr2.id]),
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
            salesManager,
            medicalReps: [mr1, mr2]
        },
        territories: {
            region: westRegion,
            state: maharashtra,
            cities: [mumbai, pune]
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

        // Check for existing data
        await checkExistingData();

        // Clear existing data if forced
        await clearExistingData();

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