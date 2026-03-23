export function haversineDistance(a: [number, number], b: [number, number]): number {
	const R = 6371;
	const dLat = ((b[0] - a[0]) * Math.PI) / 180;
	const dLon = ((b[1] - a[1]) * Math.PI) / 180;
	const lat1 = (a[0] * Math.PI) / 180;
	const lat2 = (b[0] * Math.PI) / 180;
	const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Average PUV speed in urban Philippines in km/h
const AVG_SPEED_KPH = 30;

export function calcETA(distanceKm: number): string {
	const minutes = (distanceKm / AVG_SPEED_KPH) * 60;
	if (minutes < 1) return 'Less than a minute';
	if (minutes < 60) return `${Math.ceil(minutes)} min`;
	const hrs = Math.floor(minutes / 60);
	const mins = Math.ceil(minutes % 60);
	return `${hrs}h ${mins}m`;
}
