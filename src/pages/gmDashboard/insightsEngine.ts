import { CscStats } from "../../models/csc-stats-types";
import { Insight } from "./components/InsightsPanel";
import { PlayerTargets, PlayerRoles } from "./types";

interface PlayerData {
	name: string;
	stats: CscStats;
	role?: string;
	target: Record<string, number>;
}

interface TeamData {
	players: PlayerData[];
	tierName: string;
}

export function generateInsights(
	teamData: TeamData,
	parsedPlayerTargets: PlayerTargets,
	parsedPlayerRoles: PlayerRoles,
	selectedStats: string[]
): Insight[] {
	const insights: Insight[] = [];

	teamData.players.forEach(player => {
		const playerTargetData = parsedPlayerTargets[player.name] || {};
		const role = parsedPlayerRoles[player.name];

		// Check each tracked stat
		selectedStats.forEach(statKey => {
			const currentValue = player.stats[statKey as keyof CscStats] as number | undefined;
			const targetValue = player.target[statKey];

			if (currentValue !== undefined && targetValue !== undefined) {
				const diff = currentValue - targetValue;
				const percentDiff = (diff / targetValue) * 100;

				// Critical underperformance
				if (percentDiff < -15) {
					insights.push({
						type: "critical",
						playerName: player.name,
						message: `${statKey.toUpperCase()} is ${Math.abs(percentDiff).toFixed(1)}% below target (${currentValue.toFixed(2)} vs ${targetValue.toFixed(2)})`,
						category: "performance"
					});
				}
				// Warning for moderate underperformance
				else if (percentDiff < -8) {
					insights.push({
						type: "warning",
						playerName: player.name,
						message: `${statKey.toUpperCase()} is ${Math.abs(percentDiff).toFixed(1)}% below target (${currentValue.toFixed(2)} vs ${targetValue.toFixed(2)})`,
						category: "performance"
					});
				}
				// Success for overperformance
				else if (percentDiff > 10) {
					insights.push({
						type: "success",
						playerName: player.name,
						message: `${statKey.toUpperCase()} is ${percentDiff.toFixed(1)}% above target! (${currentValue.toFixed(2)} vs ${targetValue.toFixed(2)})`,
						category: "performance"
					});
				}
			}
		});

		// Role-specific insights
		if (role) {
			analyzeRolePerformance(player, role, insights);
		}
	});

	// Team-level insights
	analyzeTeamPerformance(teamData, insights);

	return insights;
}

function analyzeRolePerformance(player: PlayerData, role: string, insights: Insight[]): void {
	const stats = player.stats;

	switch (role) {
		case "IGL":
			// IGLs should have decent utility usage and support
			if (stats.util !== undefined && stats.util < 15) {
				insights.push({
					type: "warning",
					playerName: player.name,
					message: `As IGL, utility usage is low (${stats.util.toFixed(0)}). Consider increasing nade usage for team setups.`,
					category: "role"
				});
			}
			break;

		case "AWPER":
			// AWPers should have high AWP K/R
			if (stats.awpR !== undefined && stats.awpR < 0.5) {
				insights.push({
					type: "warning",
					playerName: player.name,
					message: `AWP K/R is low (${stats.awpR.toFixed(2)}). May need to adjust positioning or consider rifle role.`,
					category: "role"
				});
			}
			break;

		case "ENTRY":
			// Entry players should have high OD attempts
			if (stats.odaR !== undefined && stats.odaR < 0.15) {
				insights.push({
					type: "warning",
					playerName: player.name,
					message: `OD Attempts/R is low (${stats.odaR.toFixed(2)}). Entry fraggers should be taking more opening duels.`,
					category: "role"
				});
			}
			// Check if OD rate is poor
			if (stats.odr !== undefined && stats.odr < 45) {
				insights.push({
					type: "info",
					playerName: player.name,
					message: `Opening duel success rate is ${stats.odr.toFixed(1)}%. May need better support or timing adjustments.`,
					category: "role"
				});
			}
			break;

		case "SUPPORT":
			// Support players should have high flash assists and utility
			if (stats.fAssists !== undefined && stats.fAssists < 0.1) {
				insights.push({
					type: "warning",
					playerName: player.name,
					message: `Flash assists are low (${stats.fAssists.toFixed(2)}). Support players should be setting up teammates more.`,
					category: "role"
				});
			}
			break;
	}
}

function analyzeTeamPerformance(teamData: TeamData, insights: Insight[]): void {
	const players = teamData.players;
	
	// Calculate team averages
	const avgRating = players.reduce((sum, p) => sum + (p.stats.rating || 0), 0) / players.length;
	const avgODAttempts = players.reduce((sum, p) => sum + (p.stats.odaR || 0), 0) / players.length;
	const avgODRate = players.reduce((sum, p) => sum + (p.stats.odr || 0), 0) / players.length;

	// High OD attempts but low rating - coordination issue
	if (avgODAttempts > 0.2 && avgRating < 1.0) {
		insights.push({
			type: "warning",
			message: `Team has high OD attempts (${avgODAttempts.toFixed(2)}/R) but low avg rating (${avgRating.toFixed(2)}). This suggests entry coordination issues.`,
			category: "team"
		});
	}

	// Low OD rate across team
	if (avgODRate < 45) {
		insights.push({
			type: "info",
			message: `Team opening duel success rate is ${avgODRate.toFixed(1)}%. Consider reviewing entry setups and utility usage.`,
			category: "team"
		});
	}

	// Check for rating imbalance
	const ratings = players.map(p => p.stats.rating || 0).filter(r => r > 0);
	if (ratings.length > 0) {
		const maxRating = Math.max(...ratings);
		const minRating = Math.min(...ratings);
		if (maxRating - minRating > 0.4) {
			insights.push({
				type: "info",
				message: `Large rating gap between players (${maxRating.toFixed(2)} - ${minRating.toFixed(2)}). Consider balancing team roles or providing additional support.`,
				category: "team"
			});
		}
	}

	// Check clutch performance
	const avgClutch = players.reduce((sum, p) => sum + (p.stats.clutchR || 0), 0) / players.length;
	if (avgClutch < 0.25) {
		insights.push({
			type: "warning",
			message: `Team clutch rating is low (${avgClutch.toFixed(2)}). Focus on post-plant positioning and 1vX practice.`,
			category: "team"
		});
	}
}

// Mock function for trend analysis (would need match history data)
export function analyzeTrends(
	playerName: string,
	statKey: string,
	recentMatches: number[]
): Insight | null {
	if (recentMatches.length < 3) return null;

	// Calculate trend
	const firstHalf = recentMatches.slice(0, Math.floor(recentMatches.length / 2));
	const secondHalf = recentMatches.slice(Math.floor(recentMatches.length / 2));
	
	const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
	const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
	
	const trendPercent = ((secondAvg - firstAvg) / firstAvg) * 100;

	// Declining trend
	if (trendPercent < -15) {
		return {
			type: "warning",
			playerName,
			message: `${statKey.toUpperCase()} has declined ${Math.abs(trendPercent).toFixed(1)}% over last ${recentMatches.length} matches`,
			category: "trend"
		};
	}

	// Improving trend
	if (trendPercent > 15) {
		return {
			type: "success",
			playerName,
			message: `${statKey.toUpperCase()} has improved ${trendPercent.toFixed(1)}% over last ${recentMatches.length} matches`,
			category: "trend"
		};
	}

	return null;
}
