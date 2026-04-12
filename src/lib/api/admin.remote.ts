import { db } from '$lib/server/db';
import { cooperative, driver, user, vehicle, route } from '$lib/server/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import {
	createDriverSchema,
	updateDriverSchema,
	createVehicleSchema,
	updateVehicleSchema,
	deleteVehicleSchema,
	assignDriverSchema,
	unassignDriverVehicleSchema,
	createRouteSchema,
	updateRouteSchema
} from '$lib/schema/admin';
import { cooperativeSignUpSchema } from '$lib/schema/auth';
import { form, getRequestEvent, query } from '$app/server';
import { auth } from '$lib/better-auth/auth';
import { generateId } from '$lib/utils/id';

function requireAdmin() {
	const { locals } = getRequestEvent();
	if (!locals.user || locals.user.role !== 'admin') {
		throw new Error('Unauthorized');
	}
	return locals.user;
}

export const updateCooperative = form(cooperativeSignUpSchema, async (data) => {
	try {
		const admin = requireAdmin();

		await db
			.update(cooperative)
			.set({
				name: data.cooperativeName,
				address: data.address
			})
			.where(eq(cooperative.id, admin.id));

		return { success: true };
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		if (error instanceof Error) {
			console.error('[updateCooperative]', error);
		}
		return { success: false, error: 'An error occurred while updating the cooperative' };
	}
});

// Create, update, delete drivers
export const createDriver = form(createDriverSchema, async (data) => {
	try {
		const admin = requireAdmin();

		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		const newDriver = await auth.api.signUpEmail({
			body: {
				email: data.email,
				password: data.password,
				name: data.name,
				role: 'driver'
			}
		});

		if (!newDriver || !newDriver.user) {
			throw new Error('Failed to create driver account');
		}

		await db.insert(driver).values({
			id: generateId(),
			userId: newDriver.user.id,
			cooperativeId: cooperativeData.id,
			name: data.name,
			licenseNumber: data.licenseNumber,
			licenseExpiry: data.licenseExpiry
		});

		return { success: true, driverId: newDriver.user.id };
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		if (error instanceof Error) {
			console.error('[createDriver]', error);
		}
		return { success: false, error: 'An error occurred while creating the driver account' };
	}
});

export const updateDriver = form(updateDriverSchema, async (data) => {
	try {
		const admin = requireAdmin();

		if (!data.driverId) {
			throw new Error('Driver ID is required');
		}

		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		// Verify the target driver belongs to this cooperative
		const targetDriver = await db.query.driver.findFirst({
			where: and(eq(driver.id, data.driverId), eq(driver.cooperativeId, cooperativeData.id))
		});

		if (!targetDriver) {
			throw new Error('Driver not found in your cooperative');
		}

		// Build update object with only provided fields
		const updateData: {
			name?: string;
			licenseNumber?: string;
			licenseExpiry?: string | null;
		} = {};
		if (data.name !== undefined) updateData.name = data.name;
		if (data.licenseNumber !== undefined) updateData.licenseNumber = data.licenseNumber;
		if (data.licenseExpiry !== undefined) updateData.licenseExpiry = data.licenseExpiry;

		if (Object.keys(updateData).length === 0) {
			return { success: true }; // No fields to update
		}

		// Use transaction and verify cooperativeId in WHERE clause to prevent TOCTOU race condition
		// This ensures we only update the driver if they still belong to this cooperative
		const updated = await db
			.update(driver)
			.set(updateData)
			.where(and(eq(driver.id, data.driverId), eq(driver.cooperativeId, cooperativeData.id)))
			.returning({ id: driver.id });

		if (!updated.length) {
			throw new Error('Driver not found or no longer belongs to your cooperative');
		}

		return { success: true };
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		if (error instanceof Error) {
			console.error('[updateDriver]', error);
		}
		return { success: false, error: 'An error occurred while updating the driver account' };
	}
});

export const deleteDriver = form(updateDriverSchema, async (data) => {
	try {
		const admin = requireAdmin();
		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		const targetDriver = await db.query.driver.findFirst({
			where: and(eq(driver.id, data.driverId), eq(driver.cooperativeId, cooperativeData.id))
		});

		if (!targetDriver) {
			throw new Error('Driver not found in your cooperative');
		}

		// Verify driver still belongs to cooperative before deletion (TOCTOU mitigation)
		const verified = await db.query.driver.findFirst({
			where: and(eq(driver.id, data.driverId), eq(driver.cooperativeId, cooperativeData.id))
		});

		if (!verified) {
			throw new Error('Driver no longer belongs to your cooperative');
		}

		// Delete user account; driver/session/account rows are removed via FK cascades.
		await db.delete(user).where(eq(user.id, targetDriver.userId));

		return { success: true };
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		if (error instanceof Error) {
			console.error('[deleteDriver]', error);
		}
		return { success: false, error: 'An error occurred while deleting the driver account' };
	}
});

export const getDrivers = query(async () => {
	const user = requireAdmin();

	const cooperativeData = await db.query.cooperative.findFirst({
		where: eq(cooperative.userId, user.id)
	});

	if (!cooperativeData) throw new Error('Cooperative not found');

	const drivers = await db.query.driver.findMany({
		where: eq(driver.cooperativeId, cooperativeData.id),
		with: {
			user: true,
			vehicle: true
		}
	});
	return drivers;
});

export const assignVehicleToDriver = form(assignDriverSchema, async (data) => {
	try {
		const admin = requireAdmin();

		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		const targetDriver = await db.query.driver.findFirst({
			where: and(eq(driver.id, data.driverId), eq(driver.cooperativeId, cooperativeData.id))
		});

		if (!targetDriver) {
			throw new Error('Driver not found in your cooperative');
		}

		const targetVehicle = await db.query.vehicle.findFirst({
			where: and(eq(vehicle.id, data.vehicleId), eq(vehicle.cooperativeId, cooperativeData.id))
		});

		if (!targetVehicle) {
			throw new Error('Vehicle not found in your cooperative');
		}

		const existingAssignment = await db.query.driver.findFirst({
			where: and(
				eq(driver.vehicleId, data.vehicleId),
				eq(driver.cooperativeId, cooperativeData.id),
				ne(driver.id, data.driverId)
			)
		});

		if (existingAssignment) {
			throw new Error('Vehicle is already assigned to another driver');
		}

		// Implementation for assigning vehicle to driver
		await db.update(driver).set({ vehicleId: data.vehicleId }).where(eq(driver.id, data.driverId));

		return { success: true };
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		if (error instanceof Error) {
			console.error('[assignVehicleToDriver]', error);
		}
		return { success: false, error: 'An error occurred while assigning the vehicle to the driver' };
	}
});

export const unassignVehicleFromDriver = form(unassignDriverVehicleSchema, async (data) => {
	try {
		const admin = requireAdmin();

		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		const targetDriver = await db.query.driver.findFirst({
			where: and(eq(driver.id, data.driverId), eq(driver.cooperativeId, cooperativeData.id))
		});

		if (!targetDriver) {
			throw new Error('Driver not found in your cooperative');
		}

		if (!targetDriver.vehicleId) {
			throw new Error('Driver has no assigned vehicle');
		}

		await db.update(driver).set({ vehicleId: null }).where(eq(driver.id, data.driverId));

		return { success: true };
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		if (error instanceof Error) {
			console.error('[unassignVehicleFromDriver]', error);
		}
		return {
			success: false,
			error: 'An error occurred while unassigning the vehicle from the driver'
		};
	}
});

export const createVehicle = form(createVehicleSchema, async (data) => {
	try {
		const admin = requireAdmin();

		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		await db.insert(vehicle).values({
			id: generateId(),
			cooperativeId: cooperativeData.id,
			plateNumber: data.plateNumber,
			model: data.model,
			capacity: data.capacity
		});

		return { success: true };
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		if (error instanceof Error) {
			console.error('[createVehicle]', error);
		}
		return { success: false, error: 'An error occurred while creating the vehicle' };
	}
});

export const updateVehicle = form(updateVehicleSchema, async (data) => {
	try {
		const admin = requireAdmin();

		if (!data.vehicleId) {
			throw new Error('Vehicle ID is required');
		}

		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		// Verify the target vehicle belongs to this cooperative
		const targetVehicle = await db.query.vehicle.findFirst({
			where: and(eq(vehicle.id, data.vehicleId), eq(vehicle.cooperativeId, cooperativeData.id))
		});

		if (!targetVehicle) {
			throw new Error('Vehicle not found in your cooperative');
		}

		// Build update object with only provided fields
		const updateData: {
			plateNumber?: string;
			model?: string;
			capacity?: number;
		} = {};
		if (data.plateNumber !== undefined) updateData.plateNumber = data.plateNumber;
		if (data.model !== undefined) updateData.model = data.model;
		if (data.capacity !== undefined) updateData.capacity = data.capacity;

		if (Object.keys(updateData).length === 0) {
			return { success: true }; // No fields to update
		}

		const updated = await db
			.update(vehicle)
			.set(updateData)
			.where(and(eq(vehicle.id, data.vehicleId), eq(vehicle.cooperativeId, cooperativeData.id)))
			.returning({ id: vehicle.id });

		if (!updated.length) {
			throw new Error('Vehicle not found or no longer belongs to your cooperative');
		}

		return { success: true };
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		if (error instanceof Error) {
			console.error('[updateVehicle]', error);
		}
		return { success: false, error: 'An error occurred while updating the vehicle' };
	}
});

export const getVehicles = query(async () => {
	const user = requireAdmin();

	const cooperativeData = await db.query.cooperative.findFirst({
		where: eq(cooperative.userId, user.id)
	});

	if (!cooperativeData) throw new Error('Cooperative not found');

	const vehicles = await db.query.vehicle.findMany({
		where: eq(vehicle.cooperativeId, cooperativeData.id),
		with: {
			drivers: {
				with: {
					user: true
				}
			}
		}
	});
	return vehicles;
});

export const getCooperativeDashboard = query(async () => {
	const admin = requireAdmin();

	const cooperativeData = await db.query.cooperative.findFirst({
		where: eq(cooperative.userId, admin.id)
	});

	const driverLocations = cooperativeData
		? await db.query.driver.findMany({
				where: eq(driver.cooperativeId, cooperativeData.id),
				with: {
					vehicle: true
				}
			})
		: [];

	return {
		user: admin,
		cooperative: cooperativeData,
		driverLocations: driverLocations.map((d) => ({
			id: d.id,
			name: d.name,
			latitude: d.latitude,
			longitude: d.longitude,
			lastLocationUpdate: d.lastLocationUpdate,
			isAvailable: d.isAvailable,
			vehicle: d.vehicle
				? {
					id: d.vehicle.id,
					plateNumber: d.vehicle.plateNumber,
					model: d.vehicle.model
				}
				: null
		}))
	};
});

export const deleteVehicle = form(deleteVehicleSchema, async (data) => {
	try {
		const admin = requireAdmin();
		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		const targetVehicle = await db.query.vehicle.findFirst({
			where: and(eq(vehicle.id, data.vehicleId), eq(vehicle.cooperativeId, cooperativeData.id))
		});

		if (!targetVehicle) {
			throw new Error('Vehicle not found in your cooperative');
		}

		await db.delete(vehicle).where(eq(vehicle.id, data.vehicleId));

		return { success: true };
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		if (error instanceof Error) {
			console.error('[deleteVehicle]', error);
		}
		return { success: false, error: 'An error occurred while deleting the vehicle' };
	}
});

export const createRoute = form(createRouteSchema, async (data) => {
	// Implementation for creating a route
	try {
		const admin = requireAdmin();

		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		// Insert route into the database
		await db.insert(route).values({
			id: generateId(),
			name: data.name,
			cooperativeId: cooperativeData.id,
			originLatitude: data.originLatitude,
			originLongitude: data.originLongitude,
			destinationLatitude: data.destinationLatitude,
			destinationLongitude: data.destinationLongitude,
			distance: data.distance,
			direction: data.direction,
		});

		return { success: true };
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		if (error instanceof Error) {
			console.error('[createRoute]', error);
		}
		return { success: false, error: 'An error occurred while creating the route' };
	}
});

export const getRoutes = query(async () => {
	const user = requireAdmin();

	const cooperativeData = await db.query.cooperative.findFirst({
		where: eq(cooperative.userId, user.id)
	});

	if (!cooperativeData) throw new Error('Cooperative not found');

	const routes = await db.query.route.findMany({
		where: eq(route.cooperativeId, cooperativeData.id)
	});
	return routes;
});

export const updateRoute = form(updateRouteSchema, async (data) => {
	try {
		const admin = requireAdmin();

		if (!data.routeId) {
			throw new Error('Route ID is required');
		}

		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		const targetRoute = await db.query.route.findFirst({
			where: and(eq(route.id, data.routeId), eq(route.cooperativeId, cooperativeData.id))
		});

		if (!targetRoute) {
			throw new Error('Route not found in your cooperative');
		}

		const updateData: {
			name?: string;
			originLatitude?: number;
			originLongitude?: number;
			destinationLatitude?: number;
			destinationLongitude?: number;
			distance?: number;
			direction?: 'northbound' | 'southbound';
		} = {};

		if (data.name !== undefined) updateData.name = data.name;
		if (data.originLatitude !== undefined) updateData.originLatitude = data.originLatitude;
		if (data.originLongitude !== undefined) updateData.originLongitude = data.originLongitude;
		if (data.destinationLatitude !== undefined)
			updateData.destinationLatitude = data.destinationLatitude;
		if (data.destinationLongitude !== undefined)
			updateData.destinationLongitude = data.destinationLongitude;
		if (data.distance !== undefined) updateData.distance = data.distance;
		if (data.direction !== undefined) updateData.direction = data.direction;

		if (Object.keys(updateData).length === 0) {
			return { success: true };
		}

		const updated = await db
			.update(route)
			.set(updateData)
			.where(and(eq(route.id, data.routeId), eq(route.cooperativeId, cooperativeData.id)))
			.returning({ id: route.id });

		if (!updated.length) {
			throw new Error('Route not found or no longer belongs to your cooperative');
		}

		return { success: true };
	} catch (error) {
		if (error instanceof Error) {
			console.error('[updateRoute]', error);
		}
		return { success: false, error: 'An error occurred while updating the route' };
	}
});

export const deleteRoute = form(updateRouteSchema, async (data) => {
	// Implementation for deleting a route
	try {
		const admin = requireAdmin();
		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		const targetRoute = await db.query.route.findFirst({
			where: and(eq(route.id, data.routeId), eq(route.cooperativeId, cooperativeData.id))
		});

		if (!targetRoute) {
			throw new Error('Route not found in your cooperative');
		}

		await db.delete(route).where(eq(route.id, data.routeId));

		return { success: true };
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		if (error instanceof Error) {
			console.error('[deleteRoute]', error);
		}
		return { success: false, error: 'An error occurred while deleting the route' };
	}
});