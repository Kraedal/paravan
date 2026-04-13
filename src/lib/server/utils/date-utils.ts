/**
 * Get current time as a UTC Date for database storage.
 * All timestamps in the database are stored as UTC regardless of server timezone.
 */
export function getCurrentUtcDate(): Date {
	return new Date();
}

/**
 * Convert a Date to UTC by returning a new Date with the same instant.
 * Useful for ensuring consistency when the date might come from mixed sources.
 */
export function toUtcDate(date: Date): Date {
	return new Date(date.getTime());
}
