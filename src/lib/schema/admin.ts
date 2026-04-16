import z from 'zod';

// Create, update, assign, delete drivers schemas

export const createDriverSchema = z.object({
	email: z.email(),
	password: z.string().min(8, 'Password must be at least 8 characters long'),
	name: z.string().min(2).max(100),
	licenseNumber: z.string().min(5).max(20),
	licenseExpiry: z.string().refine(
		(date) => {
			const parsedDate = Date.parse(date);
			return !isNaN(parsedDate) && parsedDate > Date.now();
		},
		{
			message: 'License expiry date must be a valid future date'
		}
	)
});

export const updateDriverSchema = createDriverSchema.partial().extend({
	driverId: z.string()
});

export const assignDriverSchema = z.object({
	vehicleId: z.string(),
	driverId: z.string()
});

export const unassignDriverVehicleSchema = z.object({
	driverId: z.string()
});

// Create, update, delete vehicles schemas

export const createVehicleSchema = z.object({
	plateNumber: z.string().min(1, 'Plate number is required'),
	model: z.string().min(1, 'Model is required'),
	capacity: z.number().int().positive('Capacity must be a positive integer')
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
	vehicleId: z.string()
});

export const deleteVehicleSchema = z.object({
	vehicleId: z.string()
});

export const deleteRideSchema = z.object({
	rideId: z.string()
});

// Create, update, delete routes schemas

export const createRouteSchema = z.object({
	name: z.string().min(1, 'Route name is required'),
	originLongitude: z.number(),
	originLatitude: z.number(),
	destinationLongitude: z.number(),
	destinationLatitude: z.number(),
	distance: z.number().positive('Distance must be a positive number'),
	direction: z.enum(['northbound', 'southbound'])
});

export const updateRouteSchema = createRouteSchema.partial().extend({
	routeId: z.string()
});
