import * as React from "react";
import { CscStats } from "../../../models/csc-stats-types";
import { CollapsibleSection, SectionIcons } from "./CollapsibleSection";
import { ColorblindColors } from "../utils";

// ============================================================================
// PLAYSTYLE THRESHOLDS - Adjust these values to change classification ranges
// ============================================================================

// OD/R (Opening Duel Attempts per Round)
// Determines primary playstyle classification
const ODAR_THRESHOLDS = {
	AGGRESSIVE: 0.20,  // >= this = Aggressive
	BALANCED: 0.14,    // >= this (and < AGGRESSIVE) = Balanced
	// < BALANCED = Passive
};

// OD% (Opening Duel Success Rate)
// Shows effectiveness when dueling (does NOT affect playstyle classification)
const ODR_THRESHOLDS = {
	EFFECTIVE: 0.50,   // >= this = Effective
	NEUTRAL: 0.46,     // >= this (and < EFFECTIVE) = Neutral
	// < NEUTRAL = Risk-heavy
};

// Trade/R (Trade Kills per Round)
// Shows positioning style - low = solo/lurk, high = team-oriented
const TRADES_THRESHOLDS = {
	AGGRESSIVE: 0.13,  // <= this = Aggressive (solo/lurk style)
	BALANCED: 0.16,    // <= this (and > AGGRESSIVE) = Balanced
	// > BALANCED = Passive (team-oriented)
};

// Clutch/R (Clutch Kills per Round)
// Effectiveness indicator for passive players - shows clutch impact
const CLUTCH_THRESHOLDS = {
	ELITE: 0.070,        // > this = Elite / closer
	VERY_STRONG: 0.050,  // > this = Very strong
	GOOD: 0.035,         // > this = Good
	AVERAGE: 0.025,      // > this = Average
	BELOW_AVG: 0.015,    // > this = Below average
	// <= BELOW_AVG = Very weak clutch impact
};

// ============================================================================

interface PlaystyleAnalysisProps {
	players: Array<{ name: string; stats?: CscStats }>;
	playerTargets: Record<string, Record<string, number>>;
	selectedStats: string[];
	tierAverages: { rating?: number; odaR?: number; impact?: number };
	onHide?: () => void;
	isExpanded?: boolean;
	onToggleExpand?: (expanded: boolean) => void;
	colorblindMode?: boolean;
	customColors?: ColorblindColors;
}

type PlaystyleRating = "Aggressive" | "Balanced" | "Passive";

type ClutchRating = "Elite" | "Very Strong" | "Good" | "Average" | "Below Avg" | "Weak";

interface PlayerPlaystyle {
	name: string;
	playstyle: PlaystyleRating;
	aggressionScore: number; // 0-100, where 0 is most passive, 100 is most aggressive
	indicators: {
		odaR: { value: number; displayValue: string; rating: "Aggressive" | "Balanced" | "Passive" };
		odr: { value: number; displayValue: string; rating: "Effective" | "Neutral" | "Risk-heavy" };
		tradesR: { value: number; displayValue: string; rating: "Aggressive" | "Balanced" | "Passive" | "Low" };
		clutchR: { value: number; displayValue: string; rating: ClutchRating };
	};
	targetStats: Array<{ key: string; label: string; current: number; target?: number; diff?: number }>;
	warning?: string; // Warning for concerning patterns like low OD + low trades
}

const STAT_LABELS: Record<string, string> = {
	rating: "Rating",
	kr: "K/R",
	adr: "ADR",
	kast: "KAST",
	impact: "Impact",
	hs: "HS%",
	clutchR: "Clutch",
	awpR: "AWP K/R",
	odr: "OD%",
	odaR: "OD/R",
	tradesR: "Trade K/R",
	tRatio: "Traded%",
	suppR: "Supp Rds",
	suppXR: "Flash/R",
	util: "Util Dmg",
	fAssists: "Flash Ast",
};

const calculatePlaystyle = (
	player: { name: string; stats?: CscStats },
	playerTargets: Record<string, Record<string, number>>,
	selectedStats: string[],
	tierAverages: { rating?: number; odaR?: number; impact?: number }
): PlayerPlaystyle => {
	const stats = player.stats;
	const targets = playerTargets[player.name] || {};

	// Default values if no stats
	if (!stats) {
		return {
			name: player.name,
			playstyle: "Balanced",
			aggressionScore: 50,
			indicators: {
				odaR: { value: 0, displayValue: "N/A", rating: "Balanced" },
				odr: { value: 0, displayValue: "N/A", rating: "Neutral" },
				tradesR: { value: 0, displayValue: "N/A", rating: "Balanced" },
				clutchR: { value: 0, displayValue: "N/A", rating: "Average" },
			},
			targetStats: selectedStats.map(key => ({
				key,
				label: STAT_LABELS[key] || key,
				current: 0,
				target: targets[key],
				diff: undefined,
			})),
		};
	}

	// Get key stats for playstyle calculation
	// Round to 2 decimal places to ensure display matches classification
	const odaR = Math.round((stats.odaR || 0) * 100) / 100;
	const odr = Math.round((stats.odr || 0) * 100) / 100;
	const tradesR = Math.round((stats.tradesR || 0) * 100) / 100;
	const clutchR = Math.round((stats.clutchR || 0) * 1000) / 1000;

	// Calculate playstyle scores based on thresholds defined at top of file
	let odaRLabel: "Aggressive" | "Balanced" | "Passive";
	if (odaR >= ODAR_THRESHOLDS.AGGRESSIVE) {
		odaRLabel = "Aggressive";
	} else if (odaR >= ODAR_THRESHOLDS.BALANCED) {
		odaRLabel = "Balanced";
	} else {
		odaRLabel = "Passive";
	}

	// OD% (Opening Duel Success Rate) - effectiveness indicator only
	let odrLabel: "Effective" | "Neutral" | "Risk-heavy";
	if (odr >= ODR_THRESHOLDS.EFFECTIVE) {
		odrLabel = "Effective";
	} else if (odr >= ODR_THRESHOLDS.NEUTRAL) {
		odrLabel = "Neutral";
	} else {
		odrLabel = "Risk-heavy";
	}

	// Trade/R (Trade Kills per Round) - positioning indicator
	let tradesRLabel: "Aggressive" | "Balanced" | "Passive" | "Low";
	if (tradesR <= TRADES_THRESHOLDS.AGGRESSIVE) {
		tradesRLabel = "Aggressive";
	} else if (tradesR <= TRADES_THRESHOLDS.BALANCED) {
		tradesRLabel = "Balanced";
	} else {
		tradesRLabel = "Passive";
	}

	// Clutch/R - effectiveness indicator for passive players
	let clutchRLabel: ClutchRating;
	if (clutchR > CLUTCH_THRESHOLDS.ELITE) {
		clutchRLabel = "Elite";
	} else if (clutchR > CLUTCH_THRESHOLDS.VERY_STRONG) {
		clutchRLabel = "Very Strong";
	} else if (clutchR > CLUTCH_THRESHOLDS.GOOD) {
		clutchRLabel = "Good";
	} else if (clutchR > CLUTCH_THRESHOLDS.AVERAGE) {
		clutchRLabel = "Average";
	} else if (clutchR > CLUTCH_THRESHOLDS.BELOW_AVG) {
		clutchRLabel = "Below Avg";
	} else {
		clutchRLabel = "Weak";
	}

	// Detect concerning patterns: low OD + low trades = potential baiting or underperforming
	let warning: string | undefined;
	if (odaR < ODAR_THRESHOLDS.BALANCED && tradesR <= TRADES_THRESHOLDS.AGGRESSIVE) {
		warning = "Low OD attempts AND low trades - potential baiting or underperforming";
		tradesRLabel = "Low"; // Override to show concern
	} else if (odaR >= ODAR_THRESHOLDS.AGGRESSIVE && tradesR > TRADES_THRESHOLDS.BALANCED) {
		warning = "High OD attempts AND high trades - very active, check if overextending";
	}

	// Determine playstyle based on OD/R as the PRIMARY indicator
	// Trade/R is used to validate/adjust but OD/R is the main driver
	// OD% is NOT included - it only shows effectiveness when dueling, not playstyle
	let playstyle: PlaystyleRating;
	let aggressionScore: number;

	if (odaR >= ODAR_THRESHOLDS.AGGRESSIVE) {
		// High OD/R = Aggressive
		playstyle = "Aggressive";
		aggressionScore = Math.round(85 + Math.min(15, (odaR - ODAR_THRESHOLDS.AGGRESSIVE) * 100)); // 85-100
	} else if (odaR >= ODAR_THRESHOLDS.BALANCED) {
		// Balanced OD/R range
		// Trade/R can push it slightly one way or the other
		if (tradesR > TRADES_THRESHOLDS.BALANCED) {
			// High trades with balanced OD = leaning passive
			playstyle = "Balanced";
			aggressionScore = 45;
		} else if (tradesR <= TRADES_THRESHOLDS.AGGRESSIVE) {
			// Low trades with balanced OD = leaning aggressive
			playstyle = "Balanced";
			aggressionScore = 55;
		} else {
			playstyle = "Balanced";
			aggressionScore = 50;
		}
	} else {
		// Low OD/R = Passive
		playstyle = "Passive";
		aggressionScore = Math.round(Math.max(0, 35 - (ODAR_THRESHOLDS.BALANCED - odaR) * 200)); // 0-35
	}

	// Build target stats array
	const targetStats = selectedStats.map(key => {
		const current = stats[key as keyof CscStats] as number || 0;
		const target = targets[key];
		return {
			key,
			label: STAT_LABELS[key] || key,
			current,
			target,
			diff: target !== undefined ? current - target : undefined,
		};
	});

	return {
		name: player.name,
		playstyle,
		aggressionScore,
		indicators: {
			odaR: { value: odaR, displayValue: odaR.toFixed(2), rating: odaRLabel },
			odr: { value: odr, displayValue: `${(odr * 100).toFixed(0)}%`, rating: odrLabel },
			tradesR: { value: tradesR, displayValue: tradesR.toFixed(2), rating: tradesRLabel },
			clutchR: { value: clutchR, displayValue: clutchR.toFixed(3), rating: clutchRLabel },
		},
		targetStats,
		warning,
	};
};

export function PlaystyleAnalysis({
	players,
	playerTargets,
	selectedStats,
	tierAverages,
	onHide,
	isExpanded,
	onToggleExpand,
	colorblindMode = false,
	customColors,
}: PlaystyleAnalysisProps) {
	const playerPlaystyles = React.useMemo(() => {
		return players.map(player =>
			calculatePlaystyle(player, playerTargets, selectedStats, tierAverages)
		);
	}, [players, playerTargets, selectedStats, tierAverages]);

	const getPlaystyleColor = (playstyle: PlaystyleRating): string => {
		if (colorblindMode && !customColors) {
			if (playstyle === "Aggressive") return "text-orange-400";
			if (playstyle === "Passive") return "text-cyan-400";
			return "text-blue-400";
		}
		if (playstyle === "Aggressive") return "text-red-400";
		if (playstyle === "Passive") return "text-blue-400";
		return "text-green-400";
	};

	const getPlaystyleColorStyle = (playstyle: PlaystyleRating): React.CSSProperties => {
		if (!colorblindMode || !customColors) return {};
		if (playstyle === "Aggressive") return { color: customColors.bad };
		if (playstyle === "Passive") return { color: customColors.good };
		return { color: customColors.atTarget };
	};

	const getPlaystyleBgColor = (playstyle: PlaystyleRating): string => {
		if (colorblindMode && !customColors) {
			if (playstyle === "Aggressive") return "bg-orange-500";
			if (playstyle === "Passive") return "bg-cyan-500";
			return "bg-blue-500";
		}
		if (playstyle === "Aggressive") return "bg-red-500";
		if (playstyle === "Passive") return "bg-blue-500";
		return "bg-green-500";
	};

	const getPlaystyleBgStyle = (playstyle: PlaystyleRating): React.CSSProperties => {
		if (!colorblindMode || !customColors) return {};
		if (playstyle === "Aggressive") return { backgroundColor: customColors.bad };
		if (playstyle === "Passive") return { backgroundColor: customColors.good };
		return { backgroundColor: customColors.atTarget };
	};

	const getDiffColor = (diff: number | undefined): string => {
		if (diff === undefined) return "text-gray-500";
		if (colorblindMode && !customColors) {
			if (diff >= 0) return "text-cyan-400";
			return "text-orange-400";
		}
		if (diff >= 0) return "text-green-400";
		return "text-red-400";
	};

	const getDiffColorStyle = (diff: number | undefined): React.CSSProperties => {
		if (diff === undefined || !colorblindMode || !customColors) return {};
		if (diff >= 0) return { color: customColors.good };
		return { color: customColors.bad };
	};

	// Count playstyles for header
	const aggressiveCount = playerPlaystyles.filter(p => p.playstyle === "Aggressive").length;
	const passiveCount = playerPlaystyles.filter(p => p.playstyle === "Passive").length;
	const balancedCount = playerPlaystyles.filter(p => p.playstyle === "Balanced").length;

	const headerExtra = (
		<div className="flex items-center gap-3 ml-4 text-sm">
			<span className={`${colorblindMode && !customColors ? "text-orange-400" : "text-red-400"}`} style={colorblindMode && customColors ? { color: customColors.bad } : {}}>
				{aggressiveCount} Aggr
			</span>
			<span className={`${colorblindMode && !customColors ? "text-blue-400" : "text-green-400"}`} style={colorblindMode && customColors ? { color: customColors.atTarget } : {}}>
				{balancedCount} Bal
			</span>
			<span className={`${colorblindMode && !customColors ? "text-cyan-400" : "text-blue-400"}`} style={colorblindMode && customColors ? { color: customColors.good } : {}}>
				{passiveCount} Pass
			</span>
		</div>
	);

	return (
		<CollapsibleSection
			title="Playstyle Analysis"
			icon={SectionIcons.insights}
			headerExtra={headerExtra}
			className="mb-6"
			onHide={onHide}
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
		>
			<div className="space-y-4">
				{playerPlaystyles.map((player) => (
					<div
						key={player.name}
						className="p-4 rounded-lg bg-gray-900 border border-gray-700"
					>
						{/* Player header with playstyle */}
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-3">
								<span className="text-white font-semibold">{player.name}</span>
								<span
									className={`px-2 py-1 text-xs font-semibold rounded ${getPlaystyleColor(player.playstyle)}`}
									style={getPlaystyleColorStyle(player.playstyle)}
								>
									{player.playstyle}
								</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-xs text-gray-400">Aggression:</span>
								<span className={`font-bold ${getPlaystyleColor(player.playstyle)}`} style={getPlaystyleColorStyle(player.playstyle)}>
									{player.aggressionScore}%
								</span>
							</div>
						</div>

						{/* Aggression meter */}
						<div className="mb-4">
							<div className="flex justify-between text-xs text-gray-500 mb-1">
								<span>Passive</span>
								<span>Balanced</span>
								<span>Aggressive</span>
							</div>
							<div className="h-3 bg-gray-700 rounded-full overflow-hidden relative">
								{/* Gradient background */}
								<div className="absolute inset-0 flex">
									<div className={`flex-1 ${colorblindMode && !customColors ? "bg-cyan-900" : "bg-blue-900"}`} style={colorblindMode && customColors ? { backgroundColor: customColors.good + '40' } : {}}></div>
									<div className={`flex-1 ${colorblindMode && !customColors ? "bg-blue-900" : "bg-green-900"}`} style={colorblindMode && customColors ? { backgroundColor: customColors.atTarget + '40' } : {}}></div>
									<div className={`flex-1 ${colorblindMode && !customColors ? "bg-orange-900" : "bg-red-900"}`} style={colorblindMode && customColors ? { backgroundColor: customColors.bad + '40' } : {}}></div>
								</div>
								{/* Indicator */}
								<div
									className={`absolute top-0 bottom-0 w-1 ${getPlaystyleBgColor(player.playstyle)} shadow-lg`}
									style={{
										left: `${player.aggressionScore}%`,
										transform: 'translateX(-50%)',
										...getPlaystyleBgStyle(player.playstyle),
									}}
								/>
							</div>
						</div>

						{/* Key indicators */}
						<div className="grid grid-cols-4 gap-3 mb-4 text-xs">
							<div className="p-2 bg-gray-800 rounded">
								<div className="flex justify-between items-center mb-1">
									<span className="text-gray-400">OD/R</span>
									<span className={`text-xs px-1.5 py-0.5 rounded ${
										player.indicators.odaR.rating === "Aggressive" 
											? (colorblindMode ? "bg-orange-900 text-orange-300" : "bg-red-900 text-red-300")
											: player.indicators.odaR.rating === "Passive"
												? (colorblindMode ? "bg-cyan-900 text-cyan-300" : "bg-blue-900 text-blue-300")
												: "bg-green-900 text-green-300"
									}`}>{player.indicators.odaR.rating}</span>
								</div>
								<div className="text-white font-medium text-lg">{player.indicators.odaR.displayValue}</div>
								<div className="text-gray-500 text-[10px] mt-1">≥{ODAR_THRESHOLDS.AGGRESSIVE} Aggr | {ODAR_THRESHOLDS.BALANCED}-{(ODAR_THRESHOLDS.AGGRESSIVE - 0.01).toFixed(2)} Bal | &lt;{ODAR_THRESHOLDS.BALANCED} Pass</div>
							</div>
							<div className="p-2 bg-gray-800 rounded">
								<div className="flex justify-between items-center mb-1">
									<span className="text-gray-400">OD%</span>
									<span className={`text-xs px-1.5 py-0.5 rounded ${
										player.indicators.odr.rating === "Effective" 
											? "bg-green-900 text-green-300"
											: player.indicators.odr.rating === "Risk-heavy"
												? (colorblindMode ? "bg-orange-900 text-orange-300" : "bg-red-900 text-red-300")
												: "bg-yellow-900 text-yellow-300"
									}`}>{player.indicators.odr.rating}</span>
								</div>
								<div className="text-white font-medium text-lg">{player.indicators.odr.displayValue}</div>
								<div className="text-gray-500 text-[10px] mt-1">≥{(ODR_THRESHOLDS.EFFECTIVE * 100).toFixed(0)}% Eff | {(ODR_THRESHOLDS.NEUTRAL * 100).toFixed(0)}-{((ODR_THRESHOLDS.EFFECTIVE - 0.01) * 100).toFixed(0)}% Neut | &lt;{(ODR_THRESHOLDS.NEUTRAL * 100).toFixed(0)}% Risk</div>
							</div>
							<div className="p-2 bg-gray-800 rounded">
								<div className="flex justify-between items-center mb-1">
									<span className="text-gray-400">Trade/R</span>
									<span className={`text-xs px-1.5 py-0.5 rounded ${
										player.indicators.tradesR.rating === "Aggressive" 
											? (colorblindMode ? "bg-orange-900 text-orange-300" : "bg-red-900 text-red-300")
											: player.indicators.tradesR.rating === "Passive"
												? (colorblindMode ? "bg-cyan-900 text-cyan-300" : "bg-blue-900 text-blue-300")
												: player.indicators.tradesR.rating === "Low"
													? (colorblindMode ? "bg-purple-900 text-purple-300" : "bg-red-900 text-red-300 animate-pulse")
													: "bg-green-900 text-green-300"
									}`}>{player.indicators.tradesR.rating}</span>
								</div>
								<div className="text-white font-medium text-lg">{player.indicators.tradesR.displayValue}</div>
								<div className="text-gray-500 text-[10px] mt-1">≤{TRADES_THRESHOLDS.AGGRESSIVE} Aggr | {(TRADES_THRESHOLDS.AGGRESSIVE + 0.01).toFixed(2)}-{TRADES_THRESHOLDS.BALANCED} Bal | &gt;{TRADES_THRESHOLDS.BALANCED} Pass</div>
							</div>
							<div className="p-2 bg-gray-800 rounded">
								<div className="flex justify-between items-center mb-1">
									<span className="text-gray-400">Clutch</span>
									<span className={`text-xs px-1.5 py-0.5 rounded ${
										player.indicators.clutchR.rating === "Elite" 
											? "bg-purple-900 text-purple-300"
											: player.indicators.clutchR.rating === "Very Strong"
												? "bg-green-900 text-green-300"
												: player.indicators.clutchR.rating === "Good"
													? "bg-green-900/70 text-green-300"
													: player.indicators.clutchR.rating === "Average"
														? "bg-yellow-900 text-yellow-300"
														: player.indicators.clutchR.rating === "Below Avg"
															? "bg-orange-900 text-orange-300"
															: "bg-red-900 text-red-300"
									}`}>{player.indicators.clutchR.rating}</span>
								</div>
								<div className="text-white font-medium text-lg">{player.indicators.clutchR.displayValue}</div>
								<div className="text-gray-500 text-[10px] mt-1">&gt;{CLUTCH_THRESHOLDS.GOOD} Good | &gt;{CLUTCH_THRESHOLDS.ELITE} Elite</div>
							</div>
						</div>

						{/* Warning for concerning patterns */}
						{player.warning && (
							<div className={`mb-4 p-2 rounded border text-xs ${
								player.warning.includes("baiting") 
									? (colorblindMode ? "bg-orange-900/50 border-orange-700 text-orange-300" : "bg-red-900/50 border-red-700 text-red-300")
									: "bg-yellow-900/50 border-yellow-700 text-yellow-300"
							}`}>
								<div className="flex items-center gap-2">
									<svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
										<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
									</svg>
									<span>{player.warning}</span>
								</div>
							</div>
						)}

						{/* Target stats */}
						{player.targetStats.length > 0 && (
							<div className="border-t border-gray-700 pt-3">
								<div className="text-xs text-gray-400 mb-2">Target Stats</div>
								<div className="flex flex-wrap gap-3">
									{player.targetStats.map((stat) => (
										<div key={stat.key} className="flex items-center gap-1 text-xs">
											<span className="text-gray-400">{stat.label}:</span>
											<span className="text-white font-medium">
												{typeof stat.current === 'number' && !Number.isInteger(stat.current)
													? stat.current.toFixed(2)
													: stat.current}
											</span>
											{stat.target !== undefined && (
												<>
													<span className="text-gray-500">/</span>
													<span className="text-gray-400">
														{typeof stat.target === 'number' && !Number.isInteger(stat.target)
															? stat.target.toFixed(2)
															: stat.target}
													</span>
													<span
														className={`${getDiffColor(stat.diff)}`}
														style={getDiffColorStyle(stat.diff)}
													>
														({stat.diff !== undefined && stat.diff >= 0 ? '+' : ''}
														{stat.diff !== undefined
															? (typeof stat.diff === 'number' && !Number.isInteger(stat.diff)
																? stat.diff.toFixed(2)
																: stat.diff)
															: '?'})
													</span>
												</>
											)}
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				))}
			</div>

			{/* Legend */}
			<div className="mt-4 pt-4 border-t border-gray-700">
				<div className="text-xs text-gray-400 mb-2">Playstyle Thresholds:</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-500">
					<div>
						<strong>OD/R:</strong> ≥{ODAR_THRESHOLDS.AGGRESSIVE} Aggr | {ODAR_THRESHOLDS.BALANCED}-{(ODAR_THRESHOLDS.AGGRESSIVE - 0.01).toFixed(2)} Bal | &lt;{ODAR_THRESHOLDS.BALANCED} Pass
					</div>
					<div>
						<strong>OD%:</strong> ≥{(ODR_THRESHOLDS.EFFECTIVE * 100).toFixed(0)}% Eff | {(ODR_THRESHOLDS.NEUTRAL * 100).toFixed(0)}-{((ODR_THRESHOLDS.EFFECTIVE - 0.01) * 100).toFixed(0)}% Neut | &lt;{(ODR_THRESHOLDS.NEUTRAL * 100).toFixed(0)}% Risk
					</div>
					<div>
						<strong>Trade/R:</strong> ≤{TRADES_THRESHOLDS.AGGRESSIVE} Aggr | {(TRADES_THRESHOLDS.AGGRESSIVE + 0.01).toFixed(2)}-{TRADES_THRESHOLDS.BALANCED} Bal | &gt;{TRADES_THRESHOLDS.BALANCED} Pass
					</div>
					<div>
						<strong>Clutch:</strong> &gt;{CLUTCH_THRESHOLDS.ELITE} Elite | &gt;{CLUTCH_THRESHOLDS.GOOD} Good | &gt;{CLUTCH_THRESHOLDS.AVERAGE} Avg | ≤{CLUTCH_THRESHOLDS.BELOW_AVG} Weak
					</div>
				</div>
			</div>
		</CollapsibleSection>
	);
}
