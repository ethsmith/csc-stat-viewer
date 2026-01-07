import { CscStats } from "../../models/csc-stats-types";
import { CscPlayer } from "../../models/csc-player-types";
import { PlayerTypes } from "../../common/utils/player-utils";
import { AVAILABLE_STATS } from "./types";
import { franchiseImages } from "../../common/images/franchise";

// Colorblind color configuration
export interface ColorblindColors {
	good: string;      // Above target (green -> cyan)
	atTarget: string;  // At target (blue stays blue)
	warning: string;   // Close to target (yellow -> orange)
	bad: string;       // Below target (red -> purple)
}

export const DEFAULT_COLORBLIND_COLORS: ColorblindColors = {
	good: "#22d3ee",     // cyan-400
	atTarget: "#60a5fa", // blue-400
	warning: "#fb923c",  // orange-400
	bad: "#c084fc",      // purple-400
};

export const DEFAULT_NORMAL_COLORS: ColorblindColors = {
	good: "#4ade80",     // green-400
	atTarget: "#60a5fa", // blue-400
	warning: "#facc15",  // yellow-400
	bad: "#f87171",      // red-400
};

// Parse colorblind colors from localStorage string safely
export const parseColorblindColors = (colorsString: string): ColorblindColors => {
	try {
		const parsed = JSON.parse(colorsString);
		if (parsed && typeof parsed.good === 'string' && typeof parsed.warning === 'string' && typeof parsed.bad === 'string') {
			// Handle legacy 3-color format by adding atTarget
			if (!parsed.atTarget) {
				parsed.atTarget = "#60a5fa"; // blue-400
			}
			return parsed;
		}
		return DEFAULT_COLORBLIND_COLORS;
	} catch {
		return DEFAULT_COLORBLIND_COLORS;
	}
};

// Get inline style for custom colors (since Tailwind can't use dynamic values)
export const getCustomColorStyle = (
	colorType: 'good' | 'warning' | 'bad',
	colorblindMode: boolean,
	customColors?: ColorblindColors
): React.CSSProperties => {
	if (!colorblindMode) return {};
	const colors = customColors || DEFAULT_COLORBLIND_COLORS;
	return { color: colors[colorType] };
};

export const getCustomBgColorStyle = (
	colorType: 'good' | 'warning' | 'bad',
	colorblindMode: boolean,
	customColors?: ColorblindColors
): React.CSSProperties => {
	if (!colorblindMode) return {};
	const colors = customColors || DEFAULT_COLORBLIND_COLORS;
	return { backgroundColor: colors[colorType] };
};

// Helper to get the correct team display for a player
// Uses player type from CscPlayer data to show status (FA, PFA, DE, etc.) instead of stale team names
export const getPlayerTeamDisplay = (
	playerName: string,
	statsTeam: string | undefined,
	playersData: CscPlayer[] | undefined
): string => {
	if (!playersData) {
		return statsTeam || "FA";
	}
	
	const player = playersData.find(p => p.name === playerName);
	if (!player) {
		return statsTeam || "FA";
	}
	
	// If player is signed to a team, show the team
	if (player.type === PlayerTypes.SIGNED || 
		player.type === PlayerTypes.SIGNED_PROMOTED ||
		player.type === PlayerTypes.SIGNED_SUBBED ||
		player.type === PlayerTypes.INACTIVE_RESERVE) {
		return player.team?.franchise?.prefix || player.team?.name || statsTeam || "FA";
	}
	
	// For unsigned players, show their status
	switch (player.type) {
		case PlayerTypes.FREE_AGENT:
			return "FA";
		case PlayerTypes.PERMANENT_FREE_AGENT:
			return "PFA";
		case PlayerTypes.DRAFT_ELIGIBLE:
			return "DE";
		case PlayerTypes.TEMPSIGNED:
			return "FA Sub";
		case PlayerTypes.PERMFA_TEMP_SIGNED:
			return "PFA Sub";
		case PlayerTypes.UNROSTERED_GM:
			return "GM";
		case PlayerTypes.UNROSTERED_AGM:
			return "AGM";
		case PlayerTypes.INACTIVE:
			return "Inactive";
		case PlayerTypes.EXPIRED:
			return "Expired";
		case PlayerTypes.SPECTATOR:
			return "Spectator";
		default:
			return statsTeam || "FA";
	}
};

export const getTierAverage = (
	statsCache: any,
	tierName: string,
	statKey: string
): number | undefined => {
	const tierStats = statsCache?.data?.[tierName as keyof typeof statsCache.data];
	if (!tierStats || tierStats.length === 0) return undefined;
	
	const validValues = tierStats
		.map((stat: any) => stat[statKey as keyof CscStats] as number | undefined)
		.filter((val: number | undefined): val is number => val !== undefined && !isNaN(val));
	
	if (validValues.length === 0) return undefined;
	
	const sum = validValues.reduce((acc: number, val: number) => acc + val, 0);
	return sum / validValues.length;
};

export const getPlayerTarget = (
	parsedPlayerTargets: Record<string, Record<string, number>>,
	statsCache: any,
	playerName: string,
	statKey: string,
	tierName: string
): number | undefined => {
	const playerTargetData = parsedPlayerTargets[playerName];
	if (playerTargetData && playerTargetData[statKey] !== undefined) {
		return playerTargetData[statKey];
	}
	return getTierAverage(statsCache, tierName, statKey);
};

// Determine which color category a stat falls into
export type StatColorCategory = 'good' | 'onTarget' | 'warning' | 'bad';

export const getStatColorCategory = (
	currentValue: number | undefined,
	targetValue: number | undefined,
	statKey: string
): StatColorCategory => {
	if (!currentValue || !targetValue) return 'onTarget';
	const diff = currentValue - targetValue;
	const threshold = statKey === "rating" ? 0.03 : targetValue * 0.05;
	
	if (diff > threshold) return 'good';
	if (diff >= 0) return 'onTarget';
	if (diff >= -threshold) return 'warning';
	return 'bad';
};

export const getStatColor = (
	currentValue: number | undefined,
	targetValue: number | undefined,
	statKey: string,
	colorblindMode: boolean = false,
	customColors?: ColorblindColors
): string => {
	if (!currentValue || !targetValue) return "text-gray-300";
	
	const category = getStatColorCategory(currentValue, targetValue, statKey);
	
	if (colorblindMode && customColors) {
		// Return empty class - will use inline style instead
		return "";
	}
	
	if (colorblindMode) {
		// Default colorblind palette
		switch (category) {
			case 'good': return "text-cyan-400";
			case 'onTarget': return "text-blue-400";
			case 'warning': return "text-orange-400";
			case 'bad': return "text-purple-400";
		}
	}
	
	// Default palette
	switch (category) {
		case 'good': return "text-green-400";
		case 'onTarget': return "text-blue-400";
		case 'warning': return "text-yellow-400";
		case 'bad': return "text-red-400";
	}
};

// Get inline style for stat colors when using custom colorblind colors
export const getStatColorStyle = (
	currentValue: number | undefined,
	targetValue: number | undefined,
	statKey: string,
	colorblindMode: boolean,
	customColors?: ColorblindColors
): React.CSSProperties => {
	if (!colorblindMode || !customColors) return {};
	if (!currentValue || !targetValue) return { color: '#d1d5db' }; // gray-300
	
	const category = getStatColorCategory(currentValue, targetValue, statKey);
	
	switch (category) {
		case 'good': return { color: customColors.good };
		case 'onTarget': return { color: customColors.atTarget };
		case 'warning': return { color: customColors.warning };
		case 'bad': return { color: customColors.bad };
	}
};

export const getStatLabel = (statKey: string): string => {
	const stat = AVAILABLE_STATS.find(s => s.key === statKey);
	return stat?.label || statKey;
};

// Colorblind-friendly color mapping for positive/negative indicators
export const getPositiveColor = (colorblindMode: boolean = false, customColors?: ColorblindColors): string => {
	if (colorblindMode && customColors) return "";
	return colorblindMode ? "text-cyan-400" : "text-green-400";
};

export const getAtTargetColor = (colorblindMode: boolean = false, customColors?: ColorblindColors): string => {
	if (colorblindMode && customColors) return "";
	return "text-blue-400";
};

export const getNegativeColor = (colorblindMode: boolean = false, customColors?: ColorblindColors): string => {
	if (colorblindMode && customColors) return "";
	return colorblindMode ? "text-purple-400" : "text-red-400";
};

export const getWarningColor = (colorblindMode: boolean = false, customColors?: ColorblindColors): string => {
	if (colorblindMode && customColors) return "";
	return colorblindMode ? "text-orange-400" : "text-yellow-400";
};

export const getPositiveColorStyle = (colorblindMode: boolean, customColors?: ColorblindColors): React.CSSProperties => {
	if (!colorblindMode || !customColors) return {};
	return { color: customColors.good };
};

export const getAtTargetColorStyle = (colorblindMode: boolean, customColors?: ColorblindColors): React.CSSProperties => {
	if (!colorblindMode || !customColors) return {};
	return { color: customColors.atTarget };
};

export const getNegativeColorStyle = (colorblindMode: boolean, customColors?: ColorblindColors): React.CSSProperties => {
	if (!colorblindMode || !customColors) return {};
	return { color: customColors.bad };
};

export const getWarningColorStyle = (colorblindMode: boolean, customColors?: ColorblindColors): React.CSSProperties => {
	if (!colorblindMode || !customColors) return {};
	return { color: customColors.warning };
};

// Background color variants
export const getPositiveBgColor = (colorblindMode: boolean = false): string => {
	return colorblindMode ? "bg-cyan-500/20" : "bg-green-500/20";
};

export const getNegativeBgColor = (colorblindMode: boolean = false): string => {
	return colorblindMode ? "bg-purple-500/20" : "bg-red-500/20";
};

export const getPositiveBgStyle = (colorblindMode: boolean, customColors?: ColorblindColors): React.CSSProperties => {
	if (!colorblindMode || !customColors) return {};
	return { backgroundColor: customColors.good + '33' }; // 33 = 20% opacity in hex
};

export const getNegativeBgStyle = (colorblindMode: boolean, customColors?: ColorblindColors): React.CSSProperties => {
	if (!colorblindMode || !customColors) return {};
	return { backgroundColor: customColors.bad + '33' };
};

// Score-based color helpers for components like RoleFitScore
// Note: Scores use 4 tiers: 85+ (good), 70-84 (atTarget), 50-69 (warning), <50 (bad)
export const getScoreColor = (score: number, colorblindMode: boolean = false, customColors?: ColorblindColors): string => {
	if (colorblindMode && customColors) return "";
	if (score >= 85) return colorblindMode ? "text-cyan-400" : "text-green-400";
	if (score >= 70) return "text-blue-400";
	if (score >= 50) return colorblindMode ? "text-orange-400" : "text-yellow-400";
	return colorblindMode ? "text-purple-400" : "text-red-400";
};

export const getScoreColorStyle = (score: number, colorblindMode: boolean, customColors?: ColorblindColors): React.CSSProperties => {
	if (!colorblindMode || !customColors) return {};
	if (score >= 85) return { color: customColors.good };
	if (score >= 70) return { color: customColors.atTarget };
	if (score >= 50) return { color: customColors.warning };
	return { color: customColors.bad };
};

export const getScoreBgColor = (score: number, colorblindMode: boolean = false, customColors?: ColorblindColors): string => {
	if (colorblindMode && customColors) return "";
	if (score >= 85) return colorblindMode ? "bg-cyan-500" : "bg-green-500";
	if (score >= 70) return "bg-blue-500";
	if (score >= 50) return colorblindMode ? "bg-orange-500" : "bg-yellow-500";
	return colorblindMode ? "bg-purple-500" : "bg-red-500";
};

export const getScoreBgStyle = (score: number, colorblindMode: boolean, customColors?: ColorblindColors): React.CSSProperties => {
	if (!colorblindMode || !customColors) return {};
	if (score >= 85) return { backgroundColor: customColors.good };
	if (score >= 70) return { backgroundColor: customColors.atTarget };
	if (score >= 50) return { backgroundColor: customColors.warning };
	return { backgroundColor: customColors.bad };
};

export const handleExportSettings = (
	selectedFranchise: string,
	playerTargets: string,
	playerRoles: string,
	selectedStats: string,
	sectionOrder?: string,
	hiddenSections?: string,
	collapsedSections?: string,
	scoutingNotes?: string,
	colorblindMode?: string,
	colorblindColors?: string,
	tableViewFilterPresets?: string,
	myDraftList?: string
) => {
	const exportData = {
		franchise: selectedFranchise,
		playerTargets: playerTargets,
		playerRoles: playerRoles,
		selectedTargetStats: selectedStats,
		sectionOrder: sectionOrder,
		hiddenSections: hiddenSections,
		collapsedSections: collapsedSections,
		scoutingNotes: scoutingNotes,
		colorblindMode: colorblindMode,
		colorblindColors: colorblindColors,
		tableViewFilterPresets: tableViewFilterPresets,
		myDraftListByTier: myDraftList,
		exportDate: new Date().toISOString(),
		version: "1.6"
	};

	const dataStr = JSON.stringify(exportData, null, 2);
	const dataBlob = new Blob([dataStr], { type: 'application/json' });
	const url = URL.createObjectURL(dataBlob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `gm-targets-${selectedFranchise}-${new Date().toISOString().split('T')[0]}.json`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
};

export const createImportHandler = (
	setPlayerTargets: (value: string) => void,
	setPlayerRoles: (value: string) => void,
	setSelectedStats: (value: string) => void,
	setSelectedFranchise?: (value: string) => void,
	setSectionOrder?: (value: string) => void,
	setHiddenSections?: (value: string) => void,
	setCollapsedSections?: (value: string) => void,
	setScoutingNotes?: (value: string) => void,
	setColorblindMode?: (value: string) => void,
	setColorblindColors?: (value: string) => void,
	setTableViewFilterPresets?: (value: string) => void,
	setMyDraftList?: (value: string) => void
) => {
	return (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				const importData = JSON.parse(content);

				if (importData.franchise && setSelectedFranchise) {
					setSelectedFranchise(importData.franchise);
				}
				if (importData.playerTargets) {
					setPlayerTargets(importData.playerTargets);
				}
				if (importData.playerRoles) {
					setPlayerRoles(importData.playerRoles);
				}
				if (importData.selectedTargetStats) {
					setSelectedStats(importData.selectedTargetStats);
				}
				if (importData.sectionOrder && setSectionOrder) {
					setSectionOrder(importData.sectionOrder);
				}
				if (importData.hiddenSections && setHiddenSections) {
					setHiddenSections(importData.hiddenSections);
				}
				if (importData.collapsedSections && setCollapsedSections) {
					setCollapsedSections(importData.collapsedSections);
				}
				if (importData.scoutingNotes && setScoutingNotes) {
					setScoutingNotes(importData.scoutingNotes);
				}
				if (importData.colorblindMode !== undefined && setColorblindMode) {
					setColorblindMode(importData.colorblindMode);
				}
				if (importData.colorblindColors && setColorblindColors) {
					setColorblindColors(importData.colorblindColors);
				}
				if (importData.tableViewFilterPresets && setTableViewFilterPresets) {
					setTableViewFilterPresets(importData.tableViewFilterPresets);
				}
				if (importData.myDraftListByTier && setMyDraftList) {
					setMyDraftList(importData.myDraftListByTier);
				}

				alert('Settings imported successfully!');
			} catch (error) {
				alert('Error importing settings. Please check the file format.');
				console.error('Import error:', error);
			}
		};
		reader.readAsText(file);

		if (event.target) {
			event.target.value = '';
		}
	};
};

// Get franchise image URL from prefix
export const getFranchiseImage = (prefix: string): string => {
	return franchiseImages[prefix] || "";
};
