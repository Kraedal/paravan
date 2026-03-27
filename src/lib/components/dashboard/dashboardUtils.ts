// Demand level types and colors
export type DemandLevel = 'high' | 'normal' | 'low';

export const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function demandColor(level: DemandLevel | null): string {
	if (level === 'high') return '#ef4444';
	if (level === 'low') return '#22c55e';
	if (level === 'normal') return '#f59e0b';
	return '#e2e8f0';
}

export function demandBg(level: DemandLevel): string {
	if (level === 'high') return 'bg-red-50 text-red-600 ring-1 ring-red-100';
	if (level === 'low') return 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100';
	return 'bg-slate-100 text-slate-500';
}

export function confidenceColor(c: 'low' | 'medium' | 'high' | null): string {
	if (c === 'high') return '#22c55e';
	if (c === 'medium') return '#f59e0b';
	return '#94a3b8';
}

// Time slot sorting
export function sortHourSlots(slots: string[]): string[] {
	return Array.from(slots).sort((a, b) => {
		const toH = (s: string) => {
			const m = s.match(/^(\d+)(AM|PM)/i);
			if (!m) return 0;
			let h = parseInt(m[1]);
			if (m[2].toUpperCase() === 'PM' && h !== 12) h += 12;
			if (m[2].toUpperCase() === 'AM' && h === 12) h = 0;
			return h;
		};
		return toH(a) - toH(b);
	});
}
