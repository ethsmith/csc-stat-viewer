import { Match, MatchStats } from "../../models/csc-player-match-history-types";
import { CscStats } from "../../models/csc-stats-types";

/**
 * Extract trend data for a specific stat from match history
 */
export function extractStatTrend(
	matches: Match[],
	playerName: string,
	statKey: keyof CscStats,
	limit: number = 10
): number[] {
	if (!matches || matches.length === 0) return [];

	// Sort matches by date (most recent first)
	const sortedMatches = [...matches].sort((a, b) => 
		new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);

	// Take the most recent matches up to the limit
	const recentMatches = sortedMatches.slice(0, limit);

	// Extract the stat values for the player
	const trendData: number[] = [];
	
	for (const match of recentMatches) {
		const playerStats = match.matchStats.find(stat => stat.name === playerName);
		if (playerStats) {
			const value = getMatchStatValue(playerStats, statKey);
			if (value !== undefined && !isNaN(value)) {
				trendData.push(value);
			}
		}
	}

	// Return in newest-first order (same as player profile page)
	return trendData;
}

/**
 * Map CscStats keys to MatchStats properties
 */
function getMatchStatValue(matchStats: MatchStats, statKey: keyof CscStats): number | undefined {
	// Direct mappings
	const directMappings: Record<string, keyof MatchStats> = {
		'rating': 'rating',
		'adr': 'adr',
		'hs': 'hs',
		'kills': 'kills',
		'assists': 'assists',
		'deaths': 'deaths',
		'damage': 'damage',
		'utilDmg': 'utilDmg',
		'cl_1': 'cl_1',
		'cl_2': 'cl_2',
		'cl_3': 'cl_3',
		'cl_4': 'cl_4',
		'cl_5': 'cl_5',
	};

	if (directMappings[statKey]) {
		return matchStats[directMappings[statKey]] as number;
	}

	// Calculated stats
	switch (statKey) {
		case 'kr':
			// Kills per round (need totalRounds from match)
			return undefined; // Would need match.totalRounds
		case 'fAssists':
			return matchStats.FAss;
		default:
			return undefined;
	}
}

/**
 * Get all available match history data for multiple players
 */
export function getTeamMatchHistory(
	matches: Match[],
	playerNames: string[]
): Map<string, Match[]> {
	const playerMatchMap = new Map<string, Match[]>();

	playerNames.forEach(playerName => {
		const playerMatches = matches.filter(match =>
			match.matchStats.some(stat => stat.name === playerName)
		);
		playerMatchMap.set(playerName, playerMatches);
	});

	return playerMatchMap;
}

/**
 * Calculate if a player's performance is trending up or down
 */
export function calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
	if (values.length < 3) return 'stable';

	const firstHalf = values.slice(0, Math.floor(values.length / 2));
	const secondHalf = values.slice(Math.floor(values.length / 2));

	const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
	const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

	const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

	if (percentChange > 5) return 'up';
	if (percentChange < -5) return 'down';
	return 'stable';
}
