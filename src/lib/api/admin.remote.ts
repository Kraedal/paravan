import { db } from '$lib/server/db';
import { cooperative, driver, user, vehicle, route } from '$lib/server/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import {
	createDriverSchema,
	updateDriverSchema,
	createVehicleSchema,
	updateVehicleSchema,
	assignDriverSchema,
	unassignDriverVehicleSchema,
	createRouteSchema,
	updateRouteSchema,

} from '$lib/schema/admin';
import { cooperativeSignUpSchema } from '$lib/schema/auth';
import { form, getRequestEvent, query } from '$app/server';
import { auth } from '$lib/better-auth/auth';
import { generateId } from 'better-auth';


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
		console.error('Error updating cooperative:', error);
		let errorMessage = 'An error occurred while updating the cooperative';
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		return { success: false, error: errorMessage };
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
		console.error('Error creating driver:', error);
		let errorMessage = 'An error occurred while creating the driver account';
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		return { success: false, error: errorMessage };
	}
});

export const updateDriver = form(updateDriverSchema, async (data) => {
	try {
		const admin = requireAdmin();

		const cooperativeData = await db.query.cooperative.findFirst({
			where: eq(cooperative.userId, admin.id)
		});

		if (!cooperativeData) {
			throw new Error('Cooperative not found');
		}

		// Implementation for updating driver details
		await db
			.update(driver)
			.set({
				name: data.name,
				licenseNumber: data.licenseNumber,
				licenseExpiry: data.licenseExpiry
			})
			.where(eq(driver.id, admin.id));
	} catch (error) {
		console.error('Error updating driver:', error);
		let errorMessage = 'An error occurred while updating the driver account';
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		return { success: false, error: errorMessage };
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

		// Delete user account; driver/session/account rows are removed via FK cascades.
		await db.delete(user).where(eq(user.id, targetDriver.userId));

		return { success: true };
	} catch (error) {
		console.error('Error deleting driver:', error);
		let errorMessage = 'An error occurred while deleting the driver account';
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		return { success: false, error: errorMessage };
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
		console.error('Error assigning vehicle to driver:', error);
		let errorMessage = 'An error occurred while assigning the vehicle to the driver';
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		return { success: false, error: errorMessage };
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
		console.error('Error unassigning vehicle from driver:', error);
		let errorMessage = 'An error occurred while unassigning the vehicle from the driver';
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		return { success: false, error: errorMessage };
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
		console.error('Error creating vehicle:', error);
		let errorMessage = 'An error occurred while creating the vehicle';
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		return { success: false, error: errorMessage };
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

	return {
		user: admin,
		cooperative: cooperativeData
	};
});

export const deleteVehicle = form(updateVehicleSchema, async (data) => {
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
		console.error('Error deleting vehicle:', error);
		let errorMessage = 'An error occurred while deleting the vehicle';
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		return { success: false, error: errorMessage };
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
			distance: data.distance // 👈 was missing
		});

		return { success: true };
	} catch (error) {
		console.error('Error creating route:', error);
		let errorMessage = 'An error occurred while creating the route';
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		return { success: false, error: errorMessage };
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
		console.error('Error deleting route:', error);
		let errorMessage = 'An error occurred while deleting the route';
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		return { success: false, error: errorMessage };
	}
});