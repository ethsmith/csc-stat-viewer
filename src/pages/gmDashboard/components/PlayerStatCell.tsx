import * as React from "react";
import { CscStats } from "../../../models/csc-stats-types";
import { useCscStatsProfileTrendGraph } from "../../../dao/cscProfileTrendGraph";
import { Sparkline } from "./Sparkline";
import { getStatLabel } from "../utils";

interface PlayerStatCellProps {
	playerName: string;
	playerSteam64Id: string;
	statKey: string;
	currentValue: number | undefined;
	statColor: string;
	season: number;
}

export function PlayerStatCell({ 
	playerName,
	playerSteam64Id,
	statKey, 
	currentValue, 
	statColor,
	season 
}: PlayerStatCellProps) {
	// Use the same query as player profile trend graph
	const { data: profileTrendData } = useCscStatsProfileTrendGraph(
		playerSteam64Id,
		season
	);

	// Extract trend data for this stat - use the same logic as player profile
	const trendData = React.useMemo(() => {
		if (!profileTrendData || profileTrendData.length === 0) return [];
		
		// Filter for regulation matches only (matchDay includes 'M' to exclude combine matches)
		// This matches the exact logic from playerRatingGraph.tsx
		const regulationMatches = profileTrendData
			.filter(match => match.match.matchDay.includes("M"))
			.sort((a, b) => {
				// Sort by matchDay number (M08, M09, M10, etc.)
				const matchDayA = parseInt(a.match.matchDay.slice(1), 10);
				const matchDayB = parseInt(b.match.matchDay.slice(1), 10);
				return matchDayA - matchDayB;
			});
		
		// Take last 10 regulation matches
		const recentMatches = regulationMatches.slice(-10);
		
		// Map CscStats keys to ProfileTrendGraph keys
		// ProfileTrendGraph has: rating, impactRating, damage, adr, deaths, rounds, assists, KR, ef, kast, utilDmg, TRating, ctRating
		// Note: Some stats like odaR are not available in ProfileTrendGraph data
		const statMapping: Record<string, string> = {
			'rating': 'rating',
			'adr': 'adr',
			'kast': 'kast',
			'impact': 'impactRating',
			'impactRating': 'impactRating',
			'ef': 'ef',
			'util': 'utilDmg',
			'utilDmg': 'utilDmg',
			'damage': 'damage',
			'kr': 'KR',
			'KR': 'KR',
			'deaths': 'deaths',
			'assists': 'assists',
			'rounds': 'rounds',
		};
		
		const mappedKey = statMapping[statKey];
		if (!mappedKey) {
			console.warn(`No mapping found for stat key: ${statKey}`);
			return [];
		}
		
		const values = recentMatches.map(match => {
			const value = (match as any)[mappedKey];
			return typeof value === 'number' ? value : 0;
		}).filter(v => v !== 0);
		
		return values;
	}, [profileTrendData, statKey]);

	return (
		<td className="px-4 py-4 whitespace-nowrap">
			<div className="flex items-center gap-2">
				<div className={`text-sm font-semibold ${statColor} min-w-[3rem]`}>
					{currentValue !== undefined ? currentValue.toFixed(2) : "N/A"}
				</div>
				{trendData.length > 0 && (
					<Sparkline 
						data={trendData} 
						width={50} 
						height={16}
						statLabel={getStatLabel(statKey)}
					/>
				)}
			</div>
		</td>
	);
}
