import { relations } from 'drizzle-orm';
import {
	pgTable,
	text,
	timestamp,
	boolean,
	index,
	doublePrecision,
	integer
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	role: text('role', { enum: ['admin', 'driver', 'passenger', 'user'] })
		.default('user')
		.notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull()
});

export const cooperative = pgTable(
	'cooperative',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		address: text('address').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [index('cooperative_userId_idx').on(table.userId)]
);

export const driver = pgTable(
	'driver',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		cooperativeId: text('cooperative_id').references(() => cooperative.id, {
			onDelete: 'set null'
		}),
		vehicleId: text('vehicle_id').references(() => vehicle.id, { onDelete: 'set null' }),
		name: text('name').notNull(),
		licenseNumber: text('license_number').notNull(),
		latitude: doublePrecision('latitude'),
		longitude: doublePrecision('longitude'),
		lastLocationUpdate: timestamp('last_location_update'),
		isAvailable: boolean('is_available').default(false).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [index('driver_userId_idx').on(table.userId)]
);

export const passenger = pgTable(
	'passenger',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		latitude: doublePrecision('latitude'),
		longitude: doublePrecision('longitude'),
		lastLocationUpdate: timestamp('last_location_update'),
		isWaiting: boolean('is_waiting').default(false).notNull(),
		// NEW: Which route are they waiting for?
		targetRouteId: text('target_route_id').references(() => route.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [index('passenger_userId_idx').on(table.userId)]
);

export const vehicle = pgTable(
	'vehicle',
	{
		id: text('id').primaryKey(),
		cooperativeId: text('cooperative_id')
			.notNull()
			.references(() => cooperative.id, { onDelete: 'cascade' }),
		plateNumber: text('plate_number').notNull(),
		model: text('model').notNull(),
		capacity: integer('capacity').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [index('vehicle_cooperativeId_idx').on(table.cooperativeId)]
);

export const route = pgTable(
	'route',
	{
		id: text('id').primaryKey(),
		cooperativeId: text('cooperative_id')
			.notNull()
			.references(() => cooperative.id, { onDelete: 'cascade' }),
		originLatitude: doublePrecision('origin_latitude').notNull(),
		originLongitude: doublePrecision('origin_longitude').notNull(),
		destinationLatitude: doublePrecision('destination_latitude').notNull(),
		destinationLongitude: doublePrecision('destination_longitude').notNull(),
		distance: doublePrecision('distance').notNull(),
		isActive: boolean('is_active').default(false).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('route_cooperativeId_idx').on(table.cooperativeId)]
);

export const ride = pgTable(
	'ride',
	{
		id: text('id').primaryKey(),
		driverId: text('driver_id')
			.notNull()
			.references(() => driver.id, { onDelete: 'cascade' }),
		vehicleId: text('vehicle_id')
			.notNull()
			.references(() => vehicle.id, { onDelete: 'cascade' }),
		routeId: text('route_id')
			.notNull()
			.references(() => route.id, { onDelete: 'cascade' }),
		status: text('status', { enum: ['ongoing', 'completed', 'cancelled'] })
			.default('ongoing')
			.notNull(),
		direction: text('direction', { enum: ['to_destination', 'to_origin'] })
			.default('to_destination')
			.notNull(),
		// NEW: Track live occupancy so waiting users know if there is space
		availableSeats: doublePrecision('available_seats').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		endAt: timestamp('end_at')
	},
	(table) => [
		index('ride_driverId_idx').on(table.driverId),
		index('ride_vehicleId_idx').on(table.vehicleId),
		index('ride_routeId_idx').on(table.routeId)
	]
);

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at').notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_userId_idx').on(table.userId)]
);

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const userRelations = relations(user, ({ one, many }) => ({
	sessions: many(session),
	accounts: many(account),
	cooperative: one(cooperative, {
		fields: [user.id],
		references: [cooperative.userId]
	}),
	driver: one(driver, {
		fields: [user.id],
		references: [driver.userId]
	}),
	passenger: one(passenger, {
		fields: [user.id],
		references: [passenger.userId]
	})
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	})
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	})
}));

export const cooperativeRelations = relations(cooperative, ({ one, many }) => ({
	owner: one(user, {
		fields: [cooperative.userId],
		references: [user.id]
	}),
	drivers: many(driver),
	vehicles: many(vehicle),
	routes: many(route) // A cooperative manages multiple routes
}));

export const driverRelations = relations(driver, ({ one, many }) => ({
	user: one(user, {
		fields: [driver.userId],
		references: [user.id]
	}),
	cooperative: one(cooperative, {
		fields: [driver.cooperativeId],
		references: [cooperative.id]
	}),
	vehicle: one(vehicle, {
		fields: [driver.vehicleId],
		references: [vehicle.id]
	}),
	rides: many(ride)
}));

export const passengerRelations = relations(passenger, ({ one }) => ({
	user: one(user, {
		fields: [passenger.userId],
		references: [user.id]
	}),
	targetRoute: one(route, {
		// Links the passenger to the line they are waiting for
		fields: [passenger.targetRouteId],
		references: [route.id]
	})
}));

export const vehicleRelations = relations(vehicle, ({ one, many }) => ({
	cooperative: one(cooperative, {
		fields: [vehicle.cooperativeId],
		references: [cooperative.id]
	}),
	rides: many(ride),
	drivers: many(driver)
}));

export const routeRelations = relations(route, ({ one, many }) => ({
	cooperative: one(cooperative, {
		// The route belongs to the cooperative
		fields: [route.cooperativeId],
		references: [cooperative.id]
	}),
	rides: many(ride),
	waitingPassengers: many(passenger) // Allows querying all passengers waiting on this specific route
}));

export const rideRelations = relations(ride, ({ one }) => ({
	driver: one(driver, {
		fields: [ride.driverId],
		references: [driver.id]
	}),
	vehicle: one(vehicle, {
		fields: [ride.vehicleId],
		references: [vehicle.id]
	}),
	route: one(route, {
		fields: [ride.routeId],
		references: [route.id]
	})
}));
