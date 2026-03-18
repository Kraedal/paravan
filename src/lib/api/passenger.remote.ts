import { form, getRequestEvent, query } from '$app/server';
import { and, eq, sql } from 'drizzle-orm';
import { setReadySchema, requestBookingSchema, cancelBookingSchema } from '$lib/schema/passenger';
import { db } from '$lib/server/db';
import { passenger, booking } from '$lib/server/db/schema';
import { generateId } from 'better-auth';

function requirePassenger() {
  const { locals } = getRequestEvent();
  if (!locals.user) throw new Error('Not authenticated.');
  if (locals.user.role !== 'passenger') throw new Error('Unauthorized');
  return locals.user;
}

async function requirePassengerProfile() {
  const user = requirePassenger();
  const passengerProfile = await db.query.passenger.findFirst({
    where: (p, { eq }) => eq(p.userId, user.id)
  });
  if (!passengerProfile) throw new Error('Passenger profile not found');
  return passengerProfile;
}

// --- Profile ---

export const getPassengerProfile = query(async () => {
  const user = requirePassenger();
  const passengerProfile = await db.query.passenger.findFirst({
    where: (p, { eq }) => eq(p.userId, user.id),
    with: { user: true }
  });
  if (!passengerProfile) throw new Error('Passenger profile not found');
  return passengerProfile;
});

// --- Ready state ---

export const setReady = form(setReadySchema, async (data) => {
  const user = requirePassenger();

  if (data.targetRouteId) {
    const targetRoute = await db.query.route.findFirst({
      where: (r, { eq }) => eq(r.id, data.targetRouteId!)
    });
    if (!targetRoute) throw new Error('Selected route not found');
  }

  await db
    .update(passenger)
    .set({
      latitude: data.latitude,
      longitude: data.longitude,
      lastLocationUpdate: new Date(),
      isWaiting: true,
      targetRouteId: data.targetRouteId ?? null
    })
    .where(eq(passenger.userId, user.id));

  return { success: true };
});

export const setNotReady = form(async () => {
  const user = requirePassenger();

  await db
    .update(passenger)
    .set({
      latitude: null,
      longitude: null,
      lastLocationUpdate: new Date(),
      isWaiting: false,
      targetRouteId: null
    })
    .where(eq(passenger.userId, user.id));

  return { success: true };
});

// --- Discovering rides ---

export const getNearbyDrivers = query(async () => {
  const passengerProfile = await requirePassengerProfile();

  if (passengerProfile.latitude == null || passengerProfile.longitude == null || !passengerProfile.isWaiting) {
    throw new Error('Please share your location first before viewing nearby drivers');
  }

  const routeFilter = passengerProfile.targetRouteId ?? null;

  // get all available drivers that have a location and an ongoing ride
  const availableDrivers = await db.query.driver.findMany({
    where: (d, { eq, and, isNotNull }) => and(
      eq(d.isAvailable, true),
      isNotNull(d.latitude),
      isNotNull(d.longitude)
    ),
    with: {
      user: {
        columns: { name: true }
      },
      vehicle: true,
      rides: {
        where: (r, { eq, and }) => and(
          eq(r.status, 'ongoing'),
          routeFilter ? eq(r.routeId, routeFilter) : sql`true`
        ),
        with: { route: true },
        limit: 1
      }
    }
  });

  // only return drivers that have an active ride
  return availableDrivers
    .filter(d => d.rides.length > 0)
    .map(d => ({
      driverId: d.id,
      name: d.user.name,
      latitude: d.latitude!,
      longitude: d.longitude!,
      lastLocationUpdate: d.lastLocationUpdate,
      vehicle: d.vehicle,
      ride: d.rides[0],
      availableSeats: d.rides[0].availableSeats
    }));
});

// --- Booking ---

export const requestBooking = form(requestBookingSchema, async (data) => {
  const user = requirePassenger();

  await db.transaction(async (tx) => {
    const passengerProfile = await tx.query.passenger.findFirst({
      where: (p, { eq }) => eq(p.userId, user.id)
    });
    if (!passengerProfile) throw new Error('Passenger profile not found');

    if (passengerProfile.latitude == null || passengerProfile.longitude == null || !passengerProfile.isWaiting) {
      throw new Error('Please share your location first before requesting a booking');
    }

    // Serialize booking attempts per passenger to prevent duplicate active bookings.
    await tx.execute(sql`select id from ${passenger} where id = ${passengerProfile.id} for update`);

    const existingBooking = await tx.query.booking.findFirst({
      where: (b, { eq, or, and }) => and(
        eq(b.passengerId, passengerProfile.id),
        or(
          eq(b.status, 'pending'),
          eq(b.status, 'onboard')
        )
      )
    });

    if (existingBooking) throw new Error('You already have an active booking');

    const rideData = await tx.query.ride.findFirst({
      where: (r, { eq, and }) => and(
        eq(r.id, data.rideId),
        eq(r.status, 'ongoing')
      )
    });

    if (!rideData) throw new Error('Ride not found or no longer active');
    if (rideData.availableSeats <= 0) throw new Error('No available seats');

    if (passengerProfile.targetRouteId && rideData.routeId !== passengerProfile.targetRouteId) {
      throw new Error('Selected ride does not match your target route');
    }

    await tx.insert(booking).values({
      id: generateId(),
      rideId: data.rideId,
      passengerId: passengerProfile.id,
      status: 'pending',
      boardingLatitude: passengerProfile.latitude,
      boardingLongitude: passengerProfile.longitude
    });
  });

  return { success: true };
});

export const cancelBooking = form(cancelBookingSchema, async (data) => {
  const passengerProfile = await requirePassengerProfile();

  const updated = await db
    .update(booking)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(booking.id, data.bookingId),
        eq(booking.passengerId, passengerProfile.id),
        eq(booking.status, 'pending') // can only cancel pending, not onboard
      )
    )
    .returning({ id: booking.id });

  if (!updated.length) throw new Error('Booking not found or cannot be cancelled');

  return { success: true };
});

export const getActiveBooking = query(async () => {
  const passengerProfile = await requirePassengerProfile();

  const activeBooking = await db.query.booking.findFirst({
    where: (b, { eq, or, and }) => and(
      eq(b.passengerId, passengerProfile.id),
      or(
        eq(b.status, 'pending'),
        eq(b.status, 'onboard')
      )
    ),
    with: {
      ride: {
        with: {
          driver: {
            with: { user: { columns: { name: true } } }
          },
          vehicle: true,
          route: true
        }
      }
    }
  });

  return activeBooking ?? null;
});

// --- Trip history ---

export const getBookingHistory = query(async () => {
  const passengerProfile = await requirePassengerProfile();

  const history = await db.query.booking.findMany({
    where: (b, { eq, or, and }) => and(
      eq(b.passengerId, passengerProfile.id),
      or(
        eq(b.status, 'completed'),
        eq(b.status, 'cancelled')
      )
    ),
    with: {
      ride: {
        with: {
          route: true,
          vehicle: true
        }
      }
    },
    orderBy: (b, { desc }) => desc(b.createdAt)
  });

  return history;
});