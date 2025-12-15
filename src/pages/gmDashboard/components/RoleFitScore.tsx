import * as React from "react";
import { CscStats } from "../../../models/csc-stats-types";
import { PlayerRole } from "../types";
import { CollapsibleSection, SectionIcons } from "./CollapsibleSection";

interface RoleFitScoreProps {
	players: Array<{ name: string; stats?: CscStats }>;
	playerRoles: Record<string, string>;
	tierAverages: { rating?: number; odaR?: number; impact?: number };
	onHide?: () => void;
	isExpanded?: boolean;
	onToggleExpand?: (expanded: boolean) => void;
}

interface PlayerRoleFit {
	name: string;
	role: string;
	score: number;
	ratingStability: number;
	odAlignment: number;
	impactVsBaseline: number;
	fitLabel: "Excellent Fit" | "Good Fit" | "Forced Role" | "Mismatch";
	fitColor: string;
	issues: string[];
}

const ROLE_BASELINES: Record<string, { odaR: number; impact: number; awpR?: number; suppR?: number }> = {
	IGL: { odaR: 0.12, impact: 1.0, suppR: 0.4 },
	AWPER: { odaR: 0.18, impact: 1.1, awpR: 0.15 },
	ENTRY: { odaR: 0.22, impact: 1.15 },
	SUPPORT: { odaR: 0.10, impact: 0.95, suppR: 0.5 },
	RIFLER: { odaR: 0.15, impact: 1.05 },
	LURKER: { odaR: 0.12, impact: 1.0 },
};

const calculateRoleFit = (
	player: { name: string; stats?: CscStats },
	role: string,
	tierAverages: { rating?: number; odaR?: number; impact?: number }
): PlayerRoleFit => {
	const stats = player.stats;
	const baseline = ROLE_BASELINES[role] || ROLE_BASELINES.RIFLER;
	const issues: string[] = [];

	if (!stats || !role) {
		return {
			name: player.name,
			role: role || "Unassigned",
			score: 0,
			ratingStability: 0,
			odAlignment: 0,
			impactVsBaseline: 0,
			fitLabel: "Mismatch",
			fitColor: "text-red-400",
			issues: role ? ["No stats available"] : ["No role assigned"],
		};
	}

	// 1. Rating Stability (0-100) - How consistent is their rating vs tier average
	const tierAvgRating = tierAverages.rating || 1.0;
	const ratingDiff = Math.abs((stats.rating || 0) - tierAvgRating);
	const ratingStability = Math.max(0, 100 - ratingDiff * 200);

	// 2. OD Alignment (0-100) - How well does their OD match role expectations
	const expectedOD = baseline.odaR;
	const actualOD = stats.odaR || 0;
	let odAlignment = 100;
	
	if (role === "ENTRY" || role === "AWPER") {
		// Entry/AWPer should have HIGH OD
		if (actualOD < expectedOD) {
			odAlignment = Math.max(0, 100 - (expectedOD - actualOD) * 500);
			if (actualOD < expectedOD * 0.7) {
				issues.push("OD too low for role");
			}
		}
	} else if (role === "SUPPORT" || role === "IGL") {
		// Support/IGL should have LOWER OD
		if (actualOD > expectedOD * 1.5) {
			odAlignment = Math.max(0, 100 - (actualOD - expectedOD) * 300);
			issues.push("OD too high for support role");
		}
	} else {
		// Rifler/Lurker - moderate OD
		const odDiff = Math.abs(actualOD - expectedOD);
		odAlignment = Math.max(0, 100 - odDiff * 400);
	}

	// 3. Impact vs Role Baseline (0-100)
	const expectedImpact = baseline.impact;
	const actualImpact = stats.impact || 0;
	let impactVsBaseline = 100;
	
	if (role === "ENTRY" || role === "AWPER") {
		// High impact roles
		if (actualImpact < expectedImpact * 0.85) {
			impactVsBaseline = Math.max(0, (actualImpact / expectedImpact) * 100);
			issues.push("Impact below role expectations");
		}
	} else {
		// Other roles - more lenient
		const impactDiff = Math.abs(actualImpact - expectedImpact);
		impactVsBaseline = Math.max(0, 100 - impactDiff * 80);
	}

	// Role-specific checks
	if (role === "AWPER" && baseline.awpR) {
		const awpKills = stats.awpR || 0;
		if (awpKills < baseline.awpR * 0.5) {
			issues.push("Low AWP kills for AWPer");
			impactVsBaseline *= 0.8;
		}
	}

	if ((role === "SUPPORT" || role === "IGL") && baseline.suppR) {
		const suppRounds = stats.suppR || 0;
		if (suppRounds < baseline.suppR * 0.6) {
			issues.push("Low support activity");
		}
	}

	// Calculate overall score (weighted average)
	const score = Math.round(
		ratingStability * 0.3 +
		odAlignment * 0.4 +
		impactVsBaseline * 0.3
	);

	// Determine fit label and color
	let fitLabel: PlayerRoleFit["fitLabel"];
	let fitColor: string;

	if (score >= 85) {
		fitLabel = "Excellent Fit";
		fitColor = "text-green-400";
	} else if (score >= 70) {
		fitLabel = "Good Fit";
		fitColor = "text-blue-400";
	} else if (score >= 50) {
		fitLabel = "Forced Role";
		fitColor = "text-yellow-400";
	} else {
		fitLabel = "Mismatch";
		fitColor = "text-red-400";
	}

	return {
		name: player.name,
		role,
		score,
		ratingStability: Math.round(ratingStability),
		odAlignment: Math.round(odAlignment),
		impactVsBaseline: Math.round(impactVsBaseline),
		fitLabel,
		fitColor,
		issues,
	};
};

export function RoleFitScore({ players, playerRoles, tierAverages, onHide, isExpanded, onToggleExpand }: RoleFitScoreProps) {
	const roleFits = React.useMemo(() => {
		return players
			.filter(p => playerRoles[p.name])
			.map(player => calculateRoleFit(player, playerRoles[player.name], tierAverages))
			.sort((a, b) => b.score - a.score);
	}, [players, playerRoles, tierAverages]);

	const unassignedPlayers = players.filter(p => !playerRoles[p.name]);

	const avgScore = roleFits.length > 0
		? Math.round(roleFits.reduce((sum, p) => sum + p.score, 0) / roleFits.length)
		: 0;

	const mismatchCount = roleFits.filter(p => p.fitLabel === "Mismatch" || p.fitLabel === "Forced Role").length;

	const headerExtra = (
		<div className="flex items-center gap-2 ml-4">
			<span className="text-sm text-gray-400">Team Avg:</span>
			<span className={`text-lg font-bold ${avgScore >= 70 ? 'text-green-400' : avgScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
				{avgScore}%
			</span>
			{mismatchCount > 0 && (
				<span className="ml-2 px-2 py-0.5 text-xs rounded bg-red-900/50 text-red-300 border border-red-700">
					{mismatchCount} issue{mismatchCount > 1 ? 's' : ''}
				</span>
			)}
		</div>
	);

	return (
		<CollapsibleSection
			title="Role Fit Score"
			icon={SectionIcons.roleFit}
			headerExtra={headerExtra}
			className="mb-6"
			onHide={onHide}
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
		>
					{roleFits.length === 0 ? (
						<div className="text-center py-8 text-gray-400">
							<p>No roles assigned. Assign roles to players to see fit scores.</p>
						</div>
					) : (
						<div className="space-y-3">
							{roleFits.map((fit) => (
								<div
									key={fit.name}
									className={`p-4 rounded-lg border ${
										fit.fitLabel === "Mismatch"
											? "bg-red-900/20 border-red-700"
											: fit.fitLabel === "Forced Role"
											? "bg-yellow-900/20 border-yellow-700"
											: "bg-gray-900 border-gray-700"
									}`}
								>
									<div className="flex items-center justify-between mb-3">
										<div className="flex items-center gap-3">
											<span className="text-white font-semibold">{fit.name}</span>
											<span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300">
												{fit.role}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<span className={`text-2xl font-bold ${fit.fitColor}`}>
												{fit.score}%
											</span>
											<span className={`text-sm ${fit.fitColor}`}>
												{fit.fitLabel}
											</span>
										</div>
									</div>

									{/* Score breakdown */}
									<div className="grid grid-cols-3 gap-4 mb-2">
										<div>
											<div className="text-xs text-gray-400 mb-1">Rating Stability</div>
											<div className="h-2 bg-gray-700 rounded-full overflow-hidden">
												<div
													className={`h-full rounded-full ${
														fit.ratingStability >= 70 ? 'bg-green-500' :
														fit.ratingStability >= 50 ? 'bg-yellow-500' : 'bg-red-500'
													}`}
													style={{ width: `${fit.ratingStability}%` }}
												/>
											</div>
											<div className="text-xs text-gray-500 mt-0.5">{fit.ratingStability}%</div>
										</div>
										<div>
											<div className="text-xs text-gray-400 mb-1">OD Alignment</div>
											<div className="h-2 bg-gray-700 rounded-full overflow-hidden">
												<div
													className={`h-full rounded-full ${
														fit.odAlignment >= 70 ? 'bg-green-500' :
														fit.odAlignment >= 50 ? 'bg-yellow-500' : 'bg-red-500'
													}`}
													style={{ width: `${fit.odAlignment}%` }}
												/>
											</div>
											<div className="text-xs text-gray-500 mt-0.5">{fit.odAlignment}%</div>
										</div>
										<div>
											<div className="text-xs text-gray-400 mb-1">Impact vs Baseline</div>
											<div className="h-2 bg-gray-700 rounded-full overflow-hidden">
												<div
													className={`h-full rounded-full ${
														fit.impactVsBaseline >= 70 ? 'bg-green-500' :
														fit.impactVsBaseline >= 50 ? 'bg-yellow-500' : 'bg-red-500'
													}`}
													style={{ width: `${fit.impactVsBaseline}%` }}
												/>
											</div>
											<div className="text-xs text-gray-500 mt-0.5">{fit.impactVsBaseline}%</div>
										</div>
									</div>

									{/* Issues */}
									{fit.issues.length > 0 && (
										<div className="mt-2 pt-2 border-t border-gray-700">
											<div className="flex flex-wrap gap-2">
												{fit.issues.map((issue, idx) => (
													<span
														key={idx}
														className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-300 border border-red-800"
													>
														{issue}
													</span>
												))}
											</div>
										</div>
									)}
								</div>
							))}

							{/* Unassigned players */}
							{unassignedPlayers.length > 0 && (
								<div className="mt-4 p-3 rounded-lg bg-gray-900 border border-gray-700">
									<div className="text-sm text-gray-400">
										<span className="font-semibold text-yellow-400">Unassigned:</span>{" "}
										{unassignedPlayers.map(p => p.name).join(", ")}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Legend */}
					<div className="mt-4 pt-4 border-t border-gray-700">
						<div className="flex flex-wrap gap-4 text-xs text-gray-400">
							<div className="flex items-center gap-1">
								<span className="w-3 h-3 rounded-full bg-green-500"></span>
								<span>85%+ Excellent Fit</span>
							</div>
							<div className="flex items-center gap-1">
								<span className="w-3 h-3 rounded-full bg-blue-500"></span>
								<span>70-84% Good Fit</span>
							</div>
							<div className="flex items-center gap-1">
								<span className="w-3 h-3 rounded-full bg-yellow-500"></span>
								<span>50-69% Forced Role</span>
							</div>
							<div className="flex items-center gap-1">
								<span className="w-3 h-3 rounded-full bg-red-500"></span>
								<span>&lt;50% Mismatch</span>
							</div>
						</div>
					</div>
		</CollapsibleSection>
	);
}
