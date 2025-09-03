import { Request, Response } from 'express';
import SchemaManagementService from '@/services/SchemaManagementService';

const schemaService = SchemaManagementService.getInstance();

export const createHospital = async (req: Request, res: Response) => {
    try {
        const { name, email, website, address, city, state, pincode, description } = req.body;
        // Convert address to latitude and longitude using a geocoding service
        const fullAddress = `${address}, ${city}, ${state}, ${pincode}`;
        let latitude = null;
        let longitude = null;

        try {
            const fetch = (await import('node-fetch')).default;
            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`);
            const data: any = await response.json();
            if (data.status === 'OK' && data.results.length > 0) {
                latitude = data.results[0].geometry.location.lat;
                longitude = data.results[0].geometry.location.lng;
                console.log('Geocoding successful:', { latitude, longitude });
            }
        } catch (geoError) {
            console.error('Geocoding error:', geoError);
        }
        req.body.latitude = latitude;
        req.body.longitude = longitude;
        // Validate required fields
        if (!name || !email || !website || !address || !city || !state || !pincode || !description) {
            return res.status(400).json({
                success: false,
                message: "Name, email, website, address, city, state, pincode, and description are required"
            });
        }

        const tenantDb = req.tenantDb;
        const organizationId = req.user?.organizationId;
        const createdById = req.user?.id;
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        const newHospital = await tenantDb.hospital.create({
            data: {
                organizationId: organizationId || '',
                name: name || '',
                email: email || '',
                website: website || '',
                address: address || '',
                city: city || '',
                state: state || '',
                pincode: pincode || '',
                description: description || '',
                territory: {
                    connect: { id: '1' }
                },
                type: 'hospital', // Example type field
                isActive: true,
                phone: req.body.phone || '',
                latitude: req.body.latitude || null,
                longitude: req.body.longitude || null
            },
        });

        return res.status(201).json({
            success: true,
            message: "Hospital created successfully",
            data: newHospital
        });
    } catch (error) {
        console.error('Create hospital error:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to create hospital",
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    } finally {
        await schemaService.sharedDb.$disconnect();
    }
};

export const fetchHospitals = async (req: Request, res: Response) => {
    try {
        const tenantDb = req.tenantDb;
        if (!tenantDb) {
            return res.status(500).json({
                success: false,
                message: 'Tenant database connection not established'
            });
        }

        const hospitalsRaw = await tenantDb.hospital.findMany();
        const territoryIds = hospitalsRaw.map(h => h.territoryId).filter(Boolean);

        const territories = await tenantDb.territory.findMany({
            where: { id: { in: territoryIds } },
            select: { id: true, name: true }
        });

        const territoryMap = Object.fromEntries(territories.map(t => [t.id, t.name]));

        const hospitals = hospitalsRaw.map(hospital => ({
            ...hospital,
            territory: hospital.territoryId ? territoryMap[hospital.territoryId] || null : null,
            status: hospital.isActive ? 'active' : 'inactive'
        }));

        if (hospitals.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No hospitals found"
            });
        }
        return res.status(200).json({
            success: true,
            data: hospitals
        });
    } catch (error) {
        console.error('Fetch hospitals error:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch hospitals",
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
}
