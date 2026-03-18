import z from 'zod';

export const startRideSchema = z.object({
  vehicleId: z.string(),
  routeId: z.string(),
  direction: z.enum(['to_origin', 'to_destination'])
});

export const endRideSchema = z.object({
  rideId: z.string()
});

export const bookingActionSchema = z.object({
  bookingId: z.string()
});

export const updateLocationSchema = z.object({
  latitude: z.string().pipe(z.coerce.number()),
  longitude: z.string().pipe(z.coerce.number())
});

export const toggleAvailabilitySchema = z.object({}); // No fields needed, just an action