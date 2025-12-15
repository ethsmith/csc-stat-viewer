import * as React from "react";
import { CscStats } from "../../../models/csc-stats-types";

interface TeamSummaryProps {
	players: Array<{ name: string; stats?: CscStats }>;
	tierAverages: { rating?: number; odaR?: number };
	playerTargets: Record<string, Record<string, number>>;
	playerRoles: Record<string, string>;
}

interface TeamMetrics {
	avgRating: number;
	avgOdaR: number;
	targetRating: number;
	targetOdaR: number;
	roleBalance: {
		hasIGL: boolean;
		hasAWPer: boolean;
		hasEntry: boolean;
		missingRoles: string[];
		highODRoles: string[];
	};
	healthScore: number;
	healthColor: string;
	healthLabel: string;
}

const calculateTeamMetrics = (
	players: Array<{ name: string; stats?: CscStats }>,
	tierAverages: { rating?: number; odaR?: number },
	playerTargets: Record<string, Record<string, number>>,
	playerRoles: Record<string, string>
): TeamMetrics => {
	// Calculate averages
	const validPlayers = players.filter(p => p.stats);
	const avgRating = validPlayers.length > 0
		? validPlayers.reduce((sum, p) => sum + (p.stats?.rating || 0), 0) / validPlayers.length
		: 0;
	const avgOdaR = validPlayers.length > 0
		? validPlayers.reduce((sum, p) => sum + (p.stats?.odaR || 0), 0) / validPlayers.length
		: 0;

	// Get target averages
	const targetRating = tierAverages.rating || 1.0;
	const targetOdaR = tierAverages.odaR || 0.15;

	// Analyze role balance
	const roles = Object.values(playerRoles);
	const hasIGL = roles.includes("IGL");
	const hasAWPer = roles.includes("AWPER");
	const hasEntry = roles.includes("ENTRY");
	
	const missingRoles: string[] = [];
	if (!hasIGL) missingRoles.push("IGL");
	if (!hasAWPer) missingRoles.push("AWPER");
	if (!hasEntry) missingRoles.push("ENTRY");

	// Check for high OD across roles
	const highODRoles: string[] = [];
	const roleODMap: Record<string, number[]> = {};
	
	validPlayers.forEach(player => {
		const role = playerRoles[player.name];
		const odaR = player.stats?.odaR || 0;
		if (role) {
			if (!roleODMap[role]) roleODMap[role] = [];
			roleODMap[role].push(odaR);
		}
	});

	Object.entries(roleODMap).forEach(([role, odValues]) => {
		const avgOD = odValues.reduce((a, b) => a + b, 0) / odValues.length;
		if (avgOD > 0.2) { // High OD threshold
			highODRoles.push(role);
		}
	});

	// Calculate health score (0-100)
	let healthScore = 100;
	
	// Rating performance (40 points max)
	const ratingDiff = avgRating - targetRating;
	if (ratingDiff >= 0.1) healthScore -= 0;
	else if (ratingDiff >= 0) healthScore -= 10;
	else if (ratingDiff >= -0.05) healthScore -= 20;
	else if (ratingDiff >= -0.1) healthScore -= 30;
	else healthScore -= 40;

	// OD performance (30 points max)
	const odDiff = avgOdaR - targetOdaR;
	if (odDiff >= 0.05) healthScore -= 0;
	else if (odDiff >= 0) healthScore -= 10;
	else if (odDiff >= -0.03) healthScore -= 20;
	else healthScore -= 30;

	// Role balance (30 points max)
	healthScore -= missingRoles.length * 10;

	healthScore = Math.max(0, Math.min(100, healthScore));

	// Determine health color and label
	let healthColor = "text-green-400";
	let healthLabel = "Excellent";
	if (healthScore < 90) {
		healthColor = "text-green-400";
		healthLabel = "Good";
	}
	if (healthScore < 75) {
		healthColor = "text-yellow-400";
		healthLabel = "Fair";
	}
	if (healthScore < 60) {
		healthColor = "text-orange-400";
		healthLabel = "Needs Attention";
	}
	if (healthScore < 40) {
		healthColor = "text-red-400";
		healthLabel = "Critical";
	}

	return {
		avgRating,
		avgOdaR,
		targetRating,
		targetOdaR,
		roleBalance: {
			hasIGL,
			hasAWPer,
			hasEntry,
			missingRoles,
			highODRoles
		},
		healthScore,
		healthColor,
		healthLabel
	};
};

export function TeamSummary({ players, tierAverages, playerTargets, playerRoles }: TeamSummaryProps) {
	const [isExpanded, setIsExpanded] = React.useState(true);

	const metrics = React.useMemo(
		() => calculateTeamMetrics(players, tierAverages, playerTargets, playerRoles),
		[players, tierAverages, playerTargets, playerRoles]
	);

	const getRatingColor = (current: number, target: number) => {
		const diff = current - target;
		if (diff >= 0.1) return "text-green-400";
		if (diff >= 0) return "text-blue-400";
		if (diff >= -0.05) return "text-yellow-400";
		return "text-red-400";
	};

	const getODColor = (current: number, target: number) => {
		const diff = current - target;
		if (diff >= 0.05) return "text-green-400";
		if (diff >= 0) return "text-blue-400";
		if (diff >= -0.03) return "text-yellow-400";
		return "text-red-400";
	};

	return (
		<div className="mb-6 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
			{/* Header */}
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
			>
				<div className="flex items-center gap-3">
					<svg className="h-6 w-6 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
						<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
					</svg>
					<h3 className="text-xl font-bold text-white">Team Summary</h3>
					<div className="flex items-center gap-2 ml-4">
						<span className="text-sm text-gray-400">Health:</span>
						<span className={`text-lg font-bold ${metrics.healthColor}`}>
							{metrics.healthScore}
						</span>
						<span className={`text-sm ${metrics.healthColor}`}>
							({metrics.healthLabel})
						</span>
					</div>
				</div>
				<svg
					className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
				</svg>
			</button>

			{/* Content */}
			{isExpanded && (
				<div className="px-6 pb-6 pt-2">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						{/* Rating Performance */}
						<div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
							<h4 className="text-sm font-semibold text-gray-400 mb-3">Rating Performance</h4>
							<div className="space-y-2">
								<div className="flex justify-between items-center">
									<span className="text-sm text-gray-300">Team Avg:</span>
									<span className={`text-lg font-bold ${getRatingColor(metrics.avgRating, metrics.targetRating)}`}>
										{metrics.avgRating.toFixed(2)}
									</span>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-sm text-gray-300">Tier Target:</span>
									<span className="text-lg font-bold text-gray-400">
										{metrics.targetRating.toFixed(2)}
									</span>
								</div>
								<div className="flex justify-between items-center pt-2 border-t border-gray-700">
									<span className="text-sm text-gray-300">Difference:</span>
									<span className={`text-sm font-semibold ${getRatingColor(metrics.avgRating, metrics.targetRating)}`}>
										{(metrics.avgRating - metrics.targetRating >= 0 ? '+' : '')}
										{(metrics.avgRating - metrics.targetRating).toFixed(2)}
									</span>
								</div>
							</div>
						</div>

						{/* OD Performance */}
						<div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
							<h4 className="text-sm font-semibold text-gray-400 mb-3">Opening Duel Performance</h4>
							<div className="space-y-2">
								<div className="flex justify-between items-center">
									<span className="text-sm text-gray-300">Team Avg OD/R:</span>
									<span className={`text-lg font-bold ${getODColor(metrics.avgOdaR, metrics.targetOdaR)}`}>
										{metrics.avgOdaR.toFixed(2)}
									</span>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-sm text-gray-300">Tier Target:</span>
									<span className="text-lg font-bold text-gray-400">
										{metrics.targetOdaR.toFixed(2)}
									</span>
								</div>
								<div className="flex justify-between items-center pt-2 border-t border-gray-700">
									<span className="text-sm text-gray-300">Difference:</span>
									<span className={`text-sm font-semibold ${getODColor(metrics.avgOdaR, metrics.targetOdaR)}`}>
										{(metrics.avgOdaR - metrics.targetOdaR >= 0 ? '+' : '')}
										{(metrics.avgOdaR - metrics.targetOdaR).toFixed(2)}
									</span>
								</div>
							</div>
						</div>

						{/* Role Balance */}
						<div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
							<h4 className="text-sm font-semibold text-gray-400 mb-3">Role Balance</h4>
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<span className={`h-2 w-2 rounded-full ${metrics.roleBalance.hasIGL ? 'bg-green-400' : 'bg-red-400'}`}></span>
									<span className="text-sm text-gray-300">IGL Assigned</span>
								</div>
								<div className="flex items-center gap-2">
									<span className={`h-2 w-2 rounded-full ${metrics.roleBalance.hasAWPer ? 'bg-green-400' : 'bg-red-400'}`}></span>
									<span className="text-sm text-gray-300">AWPer Assigned</span>
								</div>
								<div className="flex items-center gap-2">
									<span className={`h-2 w-2 rounded-full ${metrics.roleBalance.hasEntry ? 'bg-green-400' : 'bg-red-400'}`}></span>
									<span className="text-sm text-gray-300">Entry Assigned</span>
								</div>
								
								{metrics.roleBalance.missingRoles.length > 0 && (
									<div className="mt-3 pt-3 border-t border-gray-700">
										<p className="text-xs text-yellow-400 font-semibold">
											⚠ Missing: {metrics.roleBalance.missingRoles.join(", ")}
										</p>
									</div>
								)}
								
								{metrics.roleBalance.highODRoles.length > 0 && (
									<div className="mt-2">
										<p className="text-xs text-blue-400">
											ℹ High OD: {metrics.roleBalance.highODRoles.join(", ")}
										</p>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
