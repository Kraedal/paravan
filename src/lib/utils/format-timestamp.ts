/**
 * Format a UTC timestamp from the database for display in the user's locale.
 * Assumes the input is a UTC timestamp string or Date object from the backend.
 * 
 * @param value - UTC timestamp (string ISO or Date object)
 * @param displayTimezone - Optional timezone for display (default: user's browser timezone)
 * @returns Formatted string or 'Unknown date' if invalid
 */
export function formatUtcTimestamp(
	value: string | Date | null | undefined,
	options: {
		dateStyle?: 'full' | 'long' | 'medium' | 'short';
		timeStyle?: 'full' | 'long' | 'medium' | 'short';
		displayTimezone?: string; // e.g., 'Asia/Manila' for app-wide consistency
	} = {}
): string {
	if (!value) return 'Unknown date';

	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return 'Unknown date';

	const { dateStyle = 'medium', timeStyle = 'short', displayTimezone } = options;

	const formatter = new Intl.DateTimeFormat('en-PH', {
		dateStyle,
		timeStyle,
		...(displayTimezone && { timeZone: displayTimezone })
	});

	return formatter.format(date);
}

/**
 * Format UTC timestamp with just date (no time).
 */
export function formatUtcDate(value: string | Date | null | undefined): string {
	return formatUtcTimestamp(value, { dateStyle: 'medium', timeStyle: undefined });
}

/**
 * Format UTC timestamp with just time (no date).
 */
export function formatUtcTime(value: string | Date | null | undefined): string {
	return formatUtcTimestamp(value, { dateStyle: undefined, timeStyle: 'short' });
}
