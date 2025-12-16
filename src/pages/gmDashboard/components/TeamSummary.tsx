import * as React from "react";
import { CscStats } from "../../../models/csc-stats-types";
import { CollapsibleSection, SectionIcons } from "./CollapsibleSection";
import { ColorblindColors } from "../utils";

interface TeamSummaryProps {
	players: Array<{ name: string; stats?: CscStats }>;
	tierAverages: { rating?: number; odaR?: number };
	playerTargets: Record<string, Record<string, number>>;
	playerRoles: Record<string, string>;
	onHide?: () => void;
	isExpanded?: boolean;
	onToggleExpand?: (expanded: boolean) => void;
	colorblindMode?: boolean;
	customColors?: ColorblindColors;
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

export function TeamSummary({ players, tierAverages, playerTargets, playerRoles, onHide, isExpanded, onToggleExpand, colorblindMode = false, customColors }: TeamSummaryProps) {
	const metrics = React.useMemo(
		() => calculateTeamMetrics(players, tierAverages, playerTargets, playerRoles),
		[players, tierAverages, playerTargets, playerRoles]
	);

	const getRatingColor = (current: number, target: number): { className: string; style: React.CSSProperties } => {
		const diff = current - target;
		if (colorblindMode && customColors) {
			if (diff >= 0.1) return { className: "", style: { color: customColors.good } };
			if (diff >= 0) return { className: "", style: { color: customColors.atTarget } };
			if (diff >= -0.05) return { className: "", style: { color: customColors.warning } };
			return { className: "", style: { color: customColors.bad } };
		}
		if (diff >= 0.1) return { className: colorblindMode ? "text-cyan-400" : "text-green-400", style: {} };
		if (diff >= 0) return { className: "text-blue-400", style: {} };
		if (diff >= -0.05) return { className: colorblindMode ? "text-orange-400" : "text-yellow-400", style: {} };
		return { className: colorblindMode ? "text-purple-400" : "text-red-400", style: {} };
	};

	const getODColor = (current: number, target: number): { className: string; style: React.CSSProperties } => {
		const diff = current - target;
		if (colorblindMode && customColors) {
			if (diff >= 0.05) return { className: "", style: { color: customColors.good } };
			if (diff >= 0) return { className: "", style: { color: customColors.atTarget } };
			if (diff >= -0.03) return { className: "", style: { color: customColors.warning } };
			return { className: "", style: { color: customColors.bad } };
		}
		if (diff >= 0.05) return { className: colorblindMode ? "text-cyan-400" : "text-green-400", style: {} };
		if (diff >= 0) return { className: "text-blue-400", style: {} };
		if (diff >= -0.03) return { className: colorblindMode ? "text-orange-400" : "text-yellow-400", style: {} };
		return { className: colorblindMode ? "text-purple-400" : "text-red-400", style: {} };
	};

	// Adjust health color for colorblind mode
	const getHealthColor = (): { className: string; style: React.CSSProperties } => {
		if (colorblindMode && customColors) {
			if (metrics.healthScore >= 90) return { className: "", style: { color: customColors.good } };
			if (metrics.healthScore >= 75) return { className: "", style: { color: customColors.atTarget } };
			if (metrics.healthScore >= 60) return { className: "", style: { color: customColors.warning } };
			return { className: "", style: { color: customColors.bad } };
		}
		if (colorblindMode) {
			if (metrics.healthScore >= 90) return { className: "text-cyan-400", style: {} };
			if (metrics.healthScore >= 75) return { className: "text-blue-400", style: {} };
			if (metrics.healthScore >= 60) return { className: "text-orange-400", style: {} };
			if (metrics.healthScore >= 40) return { className: "text-orange-500", style: {} };
			return { className: "text-purple-400", style: {} };
		}
		return { className: metrics.healthColor, style: {} };
	};
	const healthColorResult = getHealthColor();

	const headerExtra = (
		<div className="flex items-center gap-2 ml-4">
			<span className="text-sm text-gray-400">Health:</span>
			<span className={`text-lg font-bold ${healthColorResult.className}`} style={healthColorResult.style}>
				{metrics.healthScore}
			</span>
			<span className={`text-sm ${healthColorResult.className}`} style={healthColorResult.style}>
				({metrics.healthLabel})
			</span>
		</div>
	);

	return (
		<CollapsibleSection
			title="Team Summary"
			icon={SectionIcons.team}
			headerExtra={headerExtra}
			className="mb-6"
			onHide={onHide}
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
		>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						{/* Rating Performance */}
						<div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
							<h4 className="text-sm font-semibold text-gray-400 mb-3">Rating Performance</h4>
							<div className="space-y-2">
								<div className="flex justify-between items-center">
									<span className="text-sm text-gray-300">Team Avg:</span>
									<span className={`text-lg font-bold ${getRatingColor(metrics.avgRating, metrics.targetRating).className}`} style={getRatingColor(metrics.avgRating, metrics.targetRating).style}>
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
									<span className={`text-sm font-semibold ${getRatingColor(metrics.avgRating, metrics.targetRating).className}`} style={getRatingColor(metrics.avgRating, metrics.targetRating).style}>
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
									<span className={`text-lg font-bold ${getODColor(metrics.avgOdaR, metrics.targetOdaR).className}`} style={getODColor(metrics.avgOdaR, metrics.targetOdaR).style}>
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
									<span className={`text-sm font-semibold ${getODColor(metrics.avgOdaR, metrics.targetOdaR).className}`} style={getODColor(metrics.avgOdaR, metrics.targetOdaR).style}>
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
									<span 
										className={`h-2 w-2 rounded-full ${!colorblindMode ? (metrics.roleBalance.hasIGL ? 'bg-green-400' : 'bg-red-400') : !customColors ? (metrics.roleBalance.hasIGL ? 'bg-cyan-400' : 'bg-purple-400') : ''}`}
										style={colorblindMode && customColors ? { backgroundColor: metrics.roleBalance.hasIGL ? customColors.good : customColors.bad } : {}}
									></span>
									<span className="text-sm text-gray-300">IGL Assigned</span>
								</div>
								<div className="flex items-center gap-2">
									<span 
										className={`h-2 w-2 rounded-full ${!colorblindMode ? (metrics.roleBalance.hasAWPer ? 'bg-green-400' : 'bg-red-400') : !customColors ? (metrics.roleBalance.hasAWPer ? 'bg-cyan-400' : 'bg-purple-400') : ''}`}
										style={colorblindMode && customColors ? { backgroundColor: metrics.roleBalance.hasAWPer ? customColors.good : customColors.bad } : {}}
									></span>
									<span className="text-sm text-gray-300">AWPer Assigned</span>
								</div>
								<div className="flex items-center gap-2">
									<span 
										className={`h-2 w-2 rounded-full ${!colorblindMode ? (metrics.roleBalance.hasEntry ? 'bg-green-400' : 'bg-red-400') : !customColors ? (metrics.roleBalance.hasEntry ? 'bg-cyan-400' : 'bg-purple-400') : ''}`}
										style={colorblindMode && customColors ? { backgroundColor: metrics.roleBalance.hasEntry ? customColors.good : customColors.bad } : {}}
									></span>
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
		</CollapsibleSection>
	);
}
