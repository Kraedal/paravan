import { db } from "$lib/server/db";
import { ride, booking, driver } from "$lib/server/db/schema";
import { generateId } from "better-auth";
import { getRequestEvent } from "$app/server";
import { form, query } from "$app/server";
import { error } from "@sveltejs/kit";
import { z } from "zod";
import { endRideSchema, startRideSchema, bookingActionSchema, updateLocationSchema } from "$lib/schema/driver";
import { and, eq, gt, sql } from "drizzle-orm";

async function requireDriver() {
  const { locals } = getRequestEvent();
  if (!locals.user || locals.user.role !== 'driver') {
    throw error(401, 'Unauthorized');
  }
  const driverProfile = await db.query.driver.findFirst({
    where: (d, { eq }) => eq(d.userId, locals.user.id),
    with: {
      cooperative: true,
      vehicle: true,
      rides: {
        with: {
          route: true,
          vehicle: true
        }
      }
    }
  });
  if (!driverProfile) {
    throw error(404, 'Driver profile not found');
  }
  return driverProfile;
}

export const getDriverProfile = query(async () => {
  const driverProfile = await requireDriver();
  return driverProfile;
});

export const getCooperativeRoutes = query(async () => {
  const driverProfile = await requireDriver();
  if (!driverProfile.cooperative) {
    throw error(404, 'Cooperative not found for driver');
  }
  const cooperativeId = driverProfile.cooperative.id;
  const routes = await db.query.route.findMany({
    where: (route, { eq }) => eq(route.cooperativeId, cooperativeId)
  });
  return routes;
});

export const startRide = form(startRideSchema, async (data) => {
  const driverProfile = await requireDriver();
  
  if (!driverProfile.cooperative) {
    throw error(400, 'Driver has no associated cooperative');
  }

  // Re-check in DB to avoid relying on possibly stale loaded relations.
  const ongoingRide = await db.query.ride.findFirst({
    where: (r, { and, eq }) => and(
      eq(r.driverId, driverProfile.id),
      eq(r.status, 'ongoing')
    )
  });
  if (ongoingRide) {
    throw error(409, 'Driver already has an ongoing ride');
  }

  // Validate vehicle belongs to cooperative
  const vehicleData = await db.query.vehicle.findFirst({
    where: (v, { eq }) => eq(v.id, data.vehicleId)
  });
  if (!vehicleData) {
    throw error(404, 'Vehicle not found');
  }
  if (vehicleData.cooperativeId !== driverProfile.cooperative.id) {
    throw error(403, 'Vehicle does not belong to your cooperative');
  }

  // Validate route belongs to cooperative
  const routeData = await db.query.route.findFirst({
    where: (r, { eq }) => eq(r.id, data.routeId)
  });
  if (!routeData) {
    throw error(404, 'Route not found');
  }
  if (routeData.cooperativeId !== driverProfile.cooperative.id) {
    throw error(403, 'Route does not belong to your cooperative');
  }

  const newRide = await db.insert(ride).values({
    id: generateId(),
    driverId: driverProfile.id, 
    vehicleId: data.vehicleId,
    routeId: data.routeId,
    direction: data.direction,
    status: 'ongoing',            
    availableSeats: vehicleData.capacity
  }).returning();
  return { success: true, ride: newRide[0] };
});

export const endRide = form(endRideSchema, async (data) => {
  const driverProfile = await requireDriver();

  const endedRide = await db
    .update(ride)
    .set({ status: 'completed', endAt: new Date() })
    .where(
      and(
        eq(ride.id, data.rideId),
        eq(ride.driverId, driverProfile.id),
        eq(ride.status, 'ongoing')
      )
    )
    .returning({ id: ride.id });

  if (endedRide.length === 0) {
    throw error(409, 'Ride not found, not yours, or already ended');
  }

  return { success: true };
});

export const getOngoingRide = query(async () => {
  const driverProfile = await requireDriver();

  const ongoingRide = await db.query.ride.findFirst({
    where: (r, { and, eq }) => and(
      eq(r.driverId, driverProfile.id),
      eq(r.status, 'ongoing')
    ),
    with: {
      route: true,
      vehicle: true
    }
  });
  return ongoingRide;
});

export const getBookings = query(async () => {
  const driverProfile = await requireDriver();

  const currentRide = await db.query.ride.findFirst({
    where: (ride, { eq, and }) => and(
      eq(ride.driverId, driverProfile.id),
      eq(ride.status, 'ongoing')
    )
  });
   if (!currentRide) return [];

  const bookings = await db.query.booking.findMany({
    where: (b, { eq }) => eq(b.rideId, currentRide.id),
    with: {
      passenger: {
        with: {
          user: true
        }
      }
    }
  });
  return bookings;
});

export const acceptBooking = form(bookingActionSchema, async (data) => {
  const driverProfile = await requireDriver();

  await db.transaction(async (tx) => {
    // make sure booking belongs to driver's current ride
    const currentRide = await tx.query.ride.findFirst({
      where: (r, { eq, and }) => and(
        eq(r.driverId, driverProfile.id),
        eq(r.status, 'ongoing')
      )
    });

    if (!currentRide) throw error(404, 'No ongoing ride');

    // Debug: Check booking state before update
    const bookingBefore = await tx.query.booking.findFirst({
      where: (b, { eq }) => eq(b.id, data.bookingId)
    });
    console.log('[acceptBooking] Booking before update:', {
      bookingId: data.bookingId,
      currentRideId: currentRide.id,
      bookingExists: !!bookingBefore,
      bookingRideId: bookingBefore?.rideId,
      bookingStatus: bookingBefore?.status
    });

    const updatedBooking = await tx
      .update(booking)
      .set({ status: 'onboard', boardedAt: new Date() })
      .where(
        and(
          eq(booking.id, data.bookingId),
          eq(booking.rideId, currentRide.id),
          eq(booking.status, 'pending')
        )
      )
      .returning({ id: booking.id });

    if (!updatedBooking.length) {
      console.log('[acceptBooking] Update failed - no rows matched');
      throw error(409, 'Booking not found or already actioned');
    }

    // Atomic decrement with guard against negative seats.
    const updatedRide = await tx
      .update(ride)
      .set({ availableSeats: sql`${ride.availableSeats} - 1` })
      .where(
        and(
          eq(ride.id, currentRide.id),
          eq(ride.status, 'ongoing'),
          gt(ride.availableSeats, 0)
        )
      )
      .returning({ id: ride.id });

    if (!updatedRide.length) {
      throw error(409, 'No available seats');
    }
  });

  return { success: true };
});

export const completeBooking = form(bookingActionSchema, async (data) => {
  const driverProfile = await requireDriver();

  await db.transaction(async (tx) => {
    const currentRide = await tx.query.ride.findFirst({
      where: (r, { eq, and }) => and(
        eq(r.driverId, driverProfile.id),
        eq(r.status, 'ongoing')
      )
    });

    if (!currentRide) throw error(404, 'No ongoing ride');

    const updatedBooking = await tx
      .update(booking)
      .set({ status: 'completed', alightedAt: new Date() })
      .where(
        and(
          eq(booking.id, data.bookingId),
          eq(booking.rideId, currentRide.id),
          eq(booking.status, 'onboard')
        )
      )
      .returning({ id: booking.id });

    if (!updatedBooking.length) {
      throw error(409, 'Booking not found or passenger not onboard');
    }

    // Atomic increment prevents lost updates under concurrent writes.
    await tx
      .update(ride)
      .set({ availableSeats: sql`${ride.availableSeats} + 1` })
      .where(
        and(
          eq(ride.id, currentRide.id),
          eq(ride.status, 'ongoing')
        )
      );
  });

  return { success: true };
});

export const rejectBooking = form(bookingActionSchema, async (data) => {
  const driverProfile = await requireDriver();

  const currentRide = await db.query.ride.findFirst({
    where: (r, { eq, and }) => and(
      eq(r.driverId, driverProfile.id),
      eq(r.status, 'ongoing')
    )
  });

  if (!currentRide) throw error(404, 'No ongoing ride');

  const updated = await db
    .update(booking)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(booking.id, data.bookingId),
        eq(booking.rideId, currentRide.id),
        eq(booking.status, 'pending') // can only reject pending bookings
      )
    )
    .returning({ id: booking.id });

  if (!updated.length) throw error(409, 'Booking not found or already actioned');

  return { success: true };
});

export const updateDriverLocation = form(updateLocationSchema, async (data) => {
  const driverProfile = await requireDriver();

  await db
    .update(driver)
    .set({
      latitude: data.latitude,
      longitude: data.longitude,
      lastLocationUpdate: new Date()
    })
    .where(eq(driver.id, driverProfile.id));

  return { success: true };
});

export const toggleDriverAvailability = form(z.object(), async () => {
  const driverProfile = await requireDriver();

  const newStatus = driverProfile.isAvailable ? false : true;

  await db
    .update(driver)
    .set({ isAvailable: newStatus })
    .where(eq(driver.id, driverProfile.id));

  return { success: true, isAvailable: newStatus };
});
