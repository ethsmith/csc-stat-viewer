import { CscStats } from "../../models/csc-stats-types";
import { AVAILABLE_STATS } from "./types";

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

export const getStatColor = (
	currentValue: number | undefined,
	targetValue: number | undefined,
	statKey: string
): string => {
	if (!currentValue || !targetValue) return "text-gray-300";
	const diff = currentValue - targetValue;
	const threshold = statKey === "rating" ? 0.03 : targetValue * 0.05;
	if (diff > threshold) return "text-green-400";
	if (diff >= 0) return "text-blue-400";
	if (diff >= -threshold) return "text-yellow-400";
	return "text-red-400";
};

export const getStatLabel = (statKey: string): string => {
	const stat = AVAILABLE_STATS.find(s => s.key === statKey);
	return stat?.label || statKey;
};

export const handleExportSettings = (
	selectedFranchise: string,
	playerTargets: string,
	playerRoles: string,
	selectedStats: string
) => {
	const exportData = {
		franchise: selectedFranchise,
		playerTargets: playerTargets,
		playerRoles: playerRoles,
		selectedTargetStats: selectedStats,
		exportDate: new Date().toISOString(),
		version: "1.0"
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
	setSelectedFranchise?: (value: string) => void
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
