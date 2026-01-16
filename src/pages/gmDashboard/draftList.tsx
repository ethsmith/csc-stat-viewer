import * as React from "react";
import { Loading } from "../../common/components/loading";
import { useStatsWithFallback } from "./hooks/useStatsWithFallback";
import { useCscPlayersCache } from "../../dao/cscPlayerGraphQLDao";
import { CscStats } from "../../models/csc-stats-types";
import { GMSidebar } from "./components/GMSidebar";
import { handleExportSettings, createImportHandler, parseColorblindColors, getPlayerTeamDisplay } from "./utils";
import { useGMSettings } from "./hooks/useGMSettings";
import { useFetchFranchisesGraph } from "../../dao/franchisesGraphQLDao";
import { Franchise } from "../../models/franchise-types";
import { PlayerTypes } from "../../common/utils/player-utils";
import { PlayerRole, AVAILABLE_STATS } from "./types";
import { useEcoRatings, MapName } from "./hooks/useEcoRatings";
import { useDraftStatus } from "./hooks/useDraftStatus";
import { useExtendedStats, ExtendedPlayerStats, EXTENDED_STATS_COLUMNS } from "./hooks/useExtendedStats";

// Scouting note types
type Playstyle = "Aggressive" | "Passive";
type CommsRating = "Very Bad" | "Bad" | "Normal" | "Great" | "Excellent";

interface ScoutingNote {
	playerName: string;
	playstyle: Playstyle | "";
	role: PlayerRole | "";
	commsRating: CommsRating | "";
	notes: string;
}

export function DraftList() {
	const { data: franchises = [], isLoading: isLoadingFranchises } = useFetchFranchisesGraph();
	
	// Use shared GM settings
	const {
		selectedFranchise, setSelectedFranchise,
		colorblindMode, setColorblindMode,
		colorblindColors, setColorblindColors,
		playerTargets, setPlayerTargets,
		playerRoles, setPlayerRoles,
		selectedStats, setSelectedStats,
		sectionOrder, setSectionOrder,
		hiddenSections, setHiddenSections,
		collapsedSections, setCollapsedSections,
		scoutingNotes, setScoutingNotes,
		tableViewFilterPresets, setTableViewFilterPresets,
		myDraftList, setMyDraftList,
	} = useGMSettings();

	// Local state
	const [selectedTier, setSelectedTier] = React.useState<string>("");
	const [searchQuery, setSearchQuery] = React.useState("");
	const [showDraftedOnly, setShowDraftedOnly] = React.useState<"all" | "available" | "drafted">("all");
	const [autoRefresh, setAutoRefresh] = React.useState(true);
	const [selectedPreset, setSelectedPreset] = React.useState<string>("");
	const [statsPopupPlayer, setStatsPopupPlayer] = React.useState<string | null>(null);
	const [similarPlayerTarget, setSimilarPlayerTarget] = React.useState<string | null>(null);
	const [selectedDraftListName, setSelectedDraftListName] = React.useState<string>("Default");
	const [showNewListModal, setShowNewListModal] = React.useState(false);
	const [newListName, setNewListName] = React.useState("");

	// Extended types for map-specific sorting/filtering (matching tableView)
	type MapSortColumn = `mapRating_${MapName}` | `mapGames_${MapName}`;
	type ExtendedSortColumn = keyof CscStats | "name" | "team" | "ecoRating" | "ecoRatingDiff" | MapSortColumn;
	type ExtendedFilterStat = keyof CscStats | "ecoRating" | MapSortColumn;

	// Filter preset type matching tableView
	type FilterPreset = {
		name: string;
		teamFilter: string;
		minGames: number;
		statFilters: Array<{ stat: ExtendedFilterStat; operator: "<" | ">" | "<=" | ">=" | "="; value: number }>;
		sortColumn: ExtendedSortColumn;
		sortDirection: "asc" | "desc";
		statsSource?: "csc" | "extended";
	};

	const parsedPresets: FilterPreset[] = React.useMemo(() => {
		try {
			// Show all presets (both CSC and extended)
			return JSON.parse(tableViewFilterPresets);
		} catch {
			return [];
		}
	}, [tableViewFilterPresets]);

	const activePreset = React.useMemo(() => {
		return parsedPresets.find(p => p.name === selectedPreset) || null;
	}, [parsedPresets, selectedPreset]);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	// Parse selected stats from localStorage
	const parsedSelectedStats: string[] = React.useMemo(() => {
		try {
			const parsed = JSON.parse(selectedStats);
			return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["rating"];
		} catch {
			return ["rating"];
		}
	}, [selectedStats]);

	// Get tracked stats definitions
	const trackedStats = React.useMemo(() => {
		return AVAILABLE_STATS.filter(stat => parsedSelectedStats.includes(stat.key));
	}, [parsedSelectedStats]);

	// Parse my draft list from localStorage - keyed by tier -> listName -> players
	// New format: { tier: { listName: [players] } }
	// Old format: { tier: [players] } - will be migrated to new format under "Default" list
	const parsedMyDraftList: Record<string, Record<string, string[]>> = React.useMemo(() => {
		try {
			const parsed = JSON.parse(myDraftList);
			// Check if it's the old format (tier -> players array directly)
			const firstValue = Object.values(parsed)[0];
			if (Array.isArray(firstValue)) {
				// Migrate old format to new format
				const migrated: Record<string, Record<string, string[]>> = {};
				for (const [tier, players] of Object.entries(parsed)) {
					migrated[tier] = { "Default": players as string[] };
				}
				return migrated;
			}
			return parsed;
		} catch {
			return {};
		}
	}, [myDraftList]);

	// Get available list names for the current tier
	const availableListNames = React.useMemo(() => {
		const tierLists = parsedMyDraftList[selectedTier] || {};
		const names = Object.keys(tierLists);
		return names.length > 0 ? names : ["Default"];
	}, [parsedMyDraftList, selectedTier]);

	// Ensure selected list name exists for current tier
	React.useEffect(() => {
		if (!availableListNames.includes(selectedDraftListName)) {
			setSelectedDraftListName(availableListNames[0] || "Default");
		}
	}, [availableListNames, selectedDraftListName]);

	// Get players for the current tier and list
	const currentListPlayers = React.useMemo(() => {
		return parsedMyDraftList[selectedTier]?.[selectedDraftListName] || [];
	}, [parsedMyDraftList, selectedTier, selectedDraftListName]);

	// Parse scouting notes from localStorage - keyed by tier
	const parsedScoutingNotes: Record<string, ScoutingNote[]> = React.useMemo(() => {
		try {
			return JSON.parse(scoutingNotes);
		} catch {
			return {};
		}
	}, [scoutingNotes]);

	// Get scouting note for a player in the current tier
	const getScoutingNote = (playerName: string, tier: string): ScoutingNote | undefined => {
		const tierNotes = parsedScoutingNotes[tier] || [];
		return tierNotes.find(note => note.playerName === playerName);
	};

	// Add player to my draft list for the current tier and list
	const addToMyDraftList = (playerName: string, tier: string, listName: string = selectedDraftListName) => {
		const tierLists = parsedMyDraftList[tier] || {};
		const listPlayers = tierLists[listName] || [];
		if (!listPlayers.includes(playerName)) {
			const newTierLists = { ...tierLists, [listName]: [...listPlayers, playerName] };
			const newList = { ...parsedMyDraftList, [tier]: newTierLists };
			setMyDraftList(JSON.stringify(newList));
		}
	};

	// Remove player from my draft list
	const removeFromMyDraftList = (playerName: string, tier: string, listName: string = selectedDraftListName) => {
		const tierLists = parsedMyDraftList[tier] || {};
		const listPlayers = tierLists[listName] || [];
		const newListPlayers = listPlayers.filter(name => name !== playerName);
		const newTierLists = { ...tierLists, [listName]: newListPlayers };
		const newList = { ...parsedMyDraftList, [tier]: newTierLists };
		setMyDraftList(JSON.stringify(newList));
	};

	// Check if player is in any tier's draft list (any list)
	const isPlayerInMyDraftList = (playerName: string): boolean => {
		for (const tierLists of Object.values(parsedMyDraftList)) {
			for (const listPlayers of Object.values(tierLists)) {
				if (listPlayers.includes(playerName)) return true;
			}
		}
		return false;
	};

	// Get which tier and list a player is in (for the draft list)
	const getPlayerDraftListTier = (playerName: string): string | null => {
		for (const [tier, tierLists] of Object.entries(parsedMyDraftList)) {
			for (const listPlayers of Object.values(tierLists)) {
				if (listPlayers.includes(playerName)) return tier;
			}
		}
		return null;
	};

	// Get which list name a player is in within a tier
	const getPlayerDraftListName = (playerName: string, tier: string): string | null => {
		const tierLists = parsedMyDraftList[tier] || {};
		for (const [listName, listPlayers] of Object.entries(tierLists)) {
			if (listPlayers.includes(playerName)) return listName;
		}
		return null;
	};

	// Clear all players from a specific tier and list
	const clearTierDraftList = (tier: string, listName: string = selectedDraftListName) => {
		const tierLists = parsedMyDraftList[tier] || {};
		const newTierLists = { ...tierLists, [listName]: [] };
		const newList = { ...parsedMyDraftList, [tier]: newTierLists };
		setMyDraftList(JSON.stringify(newList));
	};

	// Create a new draft list for the current tier
	const createNewDraftList = (listName: string) => {
		if (!listName.trim()) return;
		const tierLists = parsedMyDraftList[selectedTier] || {};
		if (tierLists[listName]) return; // Already exists
		const newTierLists = { ...tierLists, [listName]: [] };
		const newList = { ...parsedMyDraftList, [selectedTier]: newTierLists };
		setMyDraftList(JSON.stringify(newList));
		setSelectedDraftListName(listName);
		setNewListName("");
		setShowNewListModal(false);
	};

	// Delete a draft list (only if not the last one)
	const deleteDraftList = (tier: string, listName: string) => {
		const tierLists = parsedMyDraftList[tier] || {};
		const listNames = Object.keys(tierLists);
		if (listNames.length <= 1) return; // Can't delete the last list
		const { [listName]: _, ...remainingLists } = tierLists;
		const newList = { ...parsedMyDraftList, [tier]: remainingLists };
		setMyDraftList(JSON.stringify(newList));
		if (selectedDraftListName === listName) {
			setSelectedDraftListName(Object.keys(remainingLists)[0] || "Default");
		}
	};

	// Move player up in the draft list (within their availability group)
	const movePlayerUp = (playerName: string, tier: string, listName: string = selectedDraftListName) => {
		const tierLists = parsedMyDraftList[tier] || {};
		const listPlayers = tierLists[listName] || [];
		const index = listPlayers.indexOf(playerName);
		if (index > 0) {
			const newListPlayers = [...listPlayers];
			[newListPlayers[index - 1], newListPlayers[index]] = [newListPlayers[index], newListPlayers[index - 1]];
			const newTierLists = { ...tierLists, [listName]: newListPlayers };
			const newList = { ...parsedMyDraftList, [tier]: newTierLists };
			setMyDraftList(JSON.stringify(newList));
		}
	};

	// Move player down in the draft list (within their availability group)
	const movePlayerDown = (playerName: string, tier: string, listName: string = selectedDraftListName) => {
		const tierLists = parsedMyDraftList[tier] || {};
		const listPlayers = tierLists[listName] || [];
		const index = listPlayers.indexOf(playerName);
		if (index < listPlayers.length - 1) {
			const newListPlayers = [...listPlayers];
			[newListPlayers[index], newListPlayers[index + 1]] = [newListPlayers[index + 1], newListPlayers[index]];
			const newTierLists = { ...tierLists, [listName]: newListPlayers };
			const newList = { ...parsedMyDraftList, [tier]: newTierLists };
			setMyDraftList(JSON.stringify(newList));
		}
	};

	const { 
		statsCache, 
		isLoading: isLoadingStats,
		isUsingFallback,
		effectiveSeason 
	} = useStatsWithFallback();

	const { data: playersData } = useCscPlayersCache(effectiveSeason);

	// Fetch draft status from shared hook
	const { 
		draftStatusMap,
		isLoading: isLoadingDraftStatus,
		refetch: refetchDraftStatus,
		dataUpdatedAt
	} = useDraftStatus({ autoRefresh, refetchInterval: 2000 });

	// Fetch eco ratings from shared hook
	const { ecoRatingMap, ecoDataMap, mapNames } = useEcoRatings();

	// Fetch extended stats from spreadsheet
	const { 
		statsByTier: extendedStatsByTier, 
		availableTiers: extendedAvailableTiers,
		isLoading: isLoadingExtendedStats 
	} = useExtendedStats();

	// Helper to format map name for display (e.g., "de_nuke" -> "Nuke")
	const formatMapName = (mapName: MapName): string => {
		return mapName.replace("de_", "").charAt(0).toUpperCase() + mapName.replace("de_", "").slice(1);
	};

	const currentFranchise = franchises.find((f: Franchise) => f.prefix === selectedFranchise);

	const availableTiers = React.useMemo(() => {
		if (!statsCache?.data) return [];
		return Object.keys(statsCache.data).filter(tier => {
			const tierStats = statsCache.data[tier as keyof typeof statsCache.data];
			return tierStats && tierStats.length > 0;
		});
	}, [statsCache]);

	// Get a player's actual current tier from player data (not stats - stats are historical)
	const getPlayerActualTier = React.useCallback((playerName: string): string | null => {
		if (!playersData) return null;
		const lowerName = playerName.toLowerCase();
		const player = playersData.find(p => p.name.toLowerCase() === lowerName);
		return player?.tier?.name || null;
	}, [playersData]);

	React.useEffect(() => {
		if (availableTiers.length > 0 && !selectedTier) {
			setSelectedTier(availableTiers[0]);
		}
	}, [availableTiers, selectedTier]);

	const tierPlayers: CscStats[] = React.useMemo(() => {
		if (!statsCache?.data || !selectedTier) return [];
		return statsCache.data[selectedTier as keyof typeof statsCache.data] || [];
	}, [statsCache, selectedTier]);

	// Extended stats tier players - filtered to only show players in their current tier
	const extendedTierPlayers: ExtendedPlayerStats[] = React.useMemo(() => {
		if (!selectedTier) return [];
		const players = extendedStatsByTier[selectedTier] || [];
		if (!playersData) return players;
		return players.filter(p => {
			const playerData = playersData.find(pd => pd.name.toLowerCase() === p.name.toLowerCase());
			if (playerData?.tier?.name) {
				return playerData.tier.name === selectedTier;
			}
			return true;
		});
	}, [extendedStatsByTier, selectedTier, playersData]);

	// Create a map of player name to player type for filtering
	const playerTypeMap = React.useMemo(() => {
		const map: Record<string, PlayerTypes | undefined> = {};
		if (playersData) {
			playersData.forEach(player => {
				map[player.name.toLowerCase()] = player.type;
			});
		}
		return map;
	}, [playersData]);

	// Filter players based on search and draft status filter
	const filteredPlayers = React.useMemo(() => {
		let players = tierPlayers;

		// Filter out PFAs and Spectators - they can't be drafted
		players = players.filter(p => {
			const playerType = playerTypeMap[p.name.toLowerCase()];
			return playerType !== PlayerTypes.PERMANENT_FREE_AGENT && 
				   playerType !== PlayerTypes.SPECTATOR;
		});

		// Apply preset filters if one is selected
		if (activePreset) {
			// Team filter
			if (activePreset.teamFilter) {
				players = players.filter(p => getPlayerTeamDisplay(p.name, p.team, playersData) === activePreset.teamFilter);
			}
			// Min games filter
			if (activePreset.minGames > 0) {
				players = players.filter(p => (p.gameCount || 0) >= activePreset.minGames);
			}
			// Stat filters
			activePreset.statFilters.forEach(filter => {
				players = players.filter(p => {
					let val: number | undefined;
					if (filter.stat === "ecoRating") {
						val = ecoRatingMap[p.name.toLowerCase()];
					} else if (filter.stat.startsWith("mapRating_")) {
						const mapName = filter.stat.replace("mapRating_", "") as MapName;
						val = ecoDataMap[p.name.toLowerCase()]?.mapData?.[mapName]?.rating;
					} else if (filter.stat.startsWith("mapGames_")) {
						const mapName = filter.stat.replace("mapGames_", "") as MapName;
						val = ecoDataMap[p.name.toLowerCase()]?.mapData?.[mapName]?.gamesPlayed;
					} else {
						val = p[filter.stat as keyof CscStats] as number | undefined;
					}
					if (val === undefined) return false;
					switch (filter.operator) {
						case "<": return val < filter.value;
						case ">": return val > filter.value;
						case "<=": return val <= filter.value;
						case ">=": return val >= filter.value;
						case "=": return val === filter.value;
						default: return true;
					}
				});
			});
		}

		// Filter by search query
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			players = players.filter(p => p.name.toLowerCase().includes(query));
		}

		// Filter by draft status
		if (showDraftedOnly === "available") {
			players = players.filter(p => !draftStatusMap[p.name.toLowerCase()]);
		} else if (showDraftedOnly === "drafted") {
			players = players.filter(p => draftStatusMap[p.name.toLowerCase()]);
		}

		// Sort: if preset has sorting, use it; otherwise use availability + rating
		let sorted = [...players];
		if (activePreset) {
			sorted.sort((a, b) => {
				let aVal: string | number | undefined;
				let bVal: string | number | undefined;
				
				if (activePreset.sortColumn === "name") {
					aVal = a.name.toLowerCase();
					bVal = b.name.toLowerCase();
				} else if (activePreset.sortColumn === "team") {
					aVal = (a.team || "").toLowerCase();
					bVal = (b.team || "").toLowerCase();
				} else if (activePreset.sortColumn === "ecoRating") {
					aVal = ecoRatingMap[a.name.toLowerCase()];
					bVal = ecoRatingMap[b.name.toLowerCase()];
				} else if (activePreset.sortColumn === "ecoRatingDiff") {
					const aEco = ecoRatingMap[a.name.toLowerCase()];
					const bEco = ecoRatingMap[b.name.toLowerCase()];
					aVal = (aEco !== undefined && a.rating) ? ((aEco - a.rating) / a.rating) * 100 : undefined;
					bVal = (bEco !== undefined && b.rating) ? ((bEco - b.rating) / b.rating) * 100 : undefined;
				} else if (activePreset.sortColumn.startsWith("mapRating_")) {
					const mapName = activePreset.sortColumn.replace("mapRating_", "") as MapName;
					aVal = ecoDataMap[a.name.toLowerCase()]?.mapData?.[mapName]?.rating;
					bVal = ecoDataMap[b.name.toLowerCase()]?.mapData?.[mapName]?.rating;
				} else if (activePreset.sortColumn.startsWith("mapGames_")) {
					const mapName = activePreset.sortColumn.replace("mapGames_", "") as MapName;
					aVal = ecoDataMap[a.name.toLowerCase()]?.mapData?.[mapName]?.gamesPlayed;
					bVal = ecoDataMap[b.name.toLowerCase()]?.mapData?.[mapName]?.gamesPlayed;
				} else {
					aVal = a[activePreset.sortColumn as keyof CscStats] as number | undefined;
					bVal = b[activePreset.sortColumn as keyof CscStats] as number | undefined;
				}
				
				if (aVal === undefined && bVal === undefined) return 0;
				if (aVal === undefined) return 1;
				if (bVal === undefined) return -1;
				
				let comparison = 0;
				if (typeof aVal === "string" && typeof bVal === "string") {
					comparison = aVal.localeCompare(bVal);
				} else {
					comparison = (aVal as number) - (bVal as number);
				}
				
				return activePreset.sortDirection === "asc" ? comparison : -comparison;
			});
		} else {
			// Default: Sort by availability first (Available, Unknown, Drafted), then by rating descending
			sorted.sort((a, b) => {
				const aStatus = draftStatusMap[a.name.toLowerCase()];
				const bStatus = draftStatusMap[b.name.toLowerCase()];
				
				const getPriority = (status: boolean | undefined) => {
					if (status === false) return 0; // Available
					if (status === undefined) return 1; // Unknown
					return 2; // Drafted
				};
				
				const priorityDiff = getPriority(aStatus) - getPriority(bStatus);
				if (priorityDiff !== 0) return priorityDiff;
				
				return (b.rating || 0) - (a.rating || 0);
			});
		}
		
		return sorted;
	}, [tierPlayers, searchQuery, showDraftedOnly, draftStatusMap, playerTypeMap, activePreset, playersData, ecoRatingMap, ecoDataMap]);

	// Filter extended stats players based on search and draft status filter
	const filteredExtendedPlayers = React.useMemo(() => {
		let players = extendedTierPlayers;

		// Filter out PFAs and Spectators - they can't be drafted
		players = players.filter(p => {
			const playerType = playerTypeMap[p.name.toLowerCase()];
			return playerType !== PlayerTypes.PERMANENT_FREE_AGENT && 
				   playerType !== PlayerTypes.SPECTATOR;
		});

		// Apply preset filters if one is selected (for extended stats presets)
		if (activePreset && activePreset.statsSource === "extended") {
			// Team filter
			if (activePreset.teamFilter) {
				players = players.filter(p => getPlayerTeamDisplay(p.name, undefined, playersData) === activePreset.teamFilter);
			}
			// Min games filter
			if (activePreset.minGames > 0) {
				players = players.filter(p => p.games_count >= activePreset.minGames);
			}
			// Stat filters - use extended stats column names
			activePreset.statFilters.forEach(filter => {
				players = players.filter(p => {
					const val = p[filter.stat as keyof ExtendedPlayerStats] as number | undefined;
					if (val === undefined) return false;
					switch (filter.operator) {
						case "<": return val < filter.value;
						case ">": return val > filter.value;
						case "<=": return val <= filter.value;
						case ">=": return val >= filter.value;
						case "=": return val === filter.value;
						default: return true;
					}
				});
			});
		}

		// Filter by search query
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			players = players.filter(p => p.name.toLowerCase().includes(query));
		}

		// Filter by draft status
		if (showDraftedOnly === "available") {
			players = players.filter(p => !draftStatusMap[p.name.toLowerCase()]);
		} else if (showDraftedOnly === "drafted") {
			players = players.filter(p => draftStatusMap[p.name.toLowerCase()]);
		}

		// Sort: if preset has sorting, use it; otherwise use availability + rating
		let sorted = [...players];
		if (activePreset && activePreset.statsSource === "extended") {
			sorted.sort((a, b) => {
				let aVal: string | number | undefined;
				let bVal: string | number | undefined;
				
				if (activePreset.sortColumn === "name") {
					aVal = a.name.toLowerCase();
					bVal = b.name.toLowerCase();
				} else {
					aVal = a[activePreset.sortColumn as keyof ExtendedPlayerStats] as number | undefined;
					bVal = b[activePreset.sortColumn as keyof ExtendedPlayerStats] as number | undefined;
				}
				
				if (aVal === undefined && bVal === undefined) return 0;
				if (aVal === undefined) return 1;
				if (bVal === undefined) return -1;
				
				let comparison = 0;
				if (typeof aVal === "string" && typeof bVal === "string") {
					comparison = aVal.localeCompare(bVal);
				} else {
					comparison = (aVal as number) - (bVal as number);
				}
				
				return activePreset.sortDirection === "asc" ? comparison : -comparison;
			});
		} else {
			// Default: Sort by availability first (Available, Unknown, Drafted), then by rating descending
			sorted.sort((a, b) => {
				const aStatus = draftStatusMap[a.name.toLowerCase()];
				const bStatus = draftStatusMap[b.name.toLowerCase()];
				
				const getPriority = (status: boolean | undefined) => {
					if (status === false) return 0; // Available
					if (status === undefined) return 1; // Unknown
					return 2; // Drafted
				};
				
				const priorityDiff = getPriority(aStatus) - getPriority(bStatus);
				if (priorityDiff !== 0) return priorityDiff;
				
				return (b.final_rating || 0) - (a.final_rating || 0);
			});
		}
		
		return sorted;
	}, [extendedTierPlayers, searchQuery, showDraftedOnly, draftStatusMap, playerTypeMap, activePreset, playersData]);

	// Find similar players based on tracked stats
	const similarPlayers = React.useMemo(() => {
		if (!similarPlayerTarget) return [];
		
		const targetPlayer = tierPlayers.find(p => p.name === similarPlayerTarget);
		if (!targetPlayer) return [];
		
		const statsToCompare = trackedStats.length > 0 
			? trackedStats.map(s => s.key) 
			: ["rating"];
		
		const playersWithScores = tierPlayers
			.filter(p => p.name !== similarPlayerTarget)
			.map(player => {
				let totalScore = 0;
				let betterOrSimilarCount = 0;
				let validStats = 0;
				
				statsToCompare.forEach(statKey => {
					const targetVal = targetPlayer[statKey as keyof CscStats] as number | undefined;
					const playerVal = player[statKey as keyof CscStats] as number | undefined;
					
					if (targetVal !== undefined && playerVal !== undefined) {
						validStats++;
						const threshold = targetVal * 0.9;
						if (playerVal >= threshold) {
							betterOrSimilarCount++;
						}
						totalScore += playerVal;
					}
				});
				
				const similarityRatio = validStats > 0 ? betterOrSimilarCount / validStats : 0;
				
				return { player, totalScore, similarityRatio, betterOrSimilarCount, validStats };
			})
			.filter(p => p.similarityRatio >= 0.5)
			.sort((a, b) => b.totalScore - a.totalScore)
			.slice(0, 20);
		
		return playersWithScores;
	}, [similarPlayerTarget, tierPlayers, trackedStats]);

	// Count available and drafted players
	const playerCounts = React.useMemo(() => {
		let available = 0;
		let drafted = 0;
		let unknown = 0;

		tierPlayers.forEach(player => {
			const status = draftStatusMap[player.name.toLowerCase()];
			if (status === true) {
				drafted++;
			} else if (status === false) {
				available++;
			} else {
				unknown++;
			}
		});

		return { available, drafted, unknown, total: tierPlayers.length };
	}, [tierPlayers, draftStatusMap]);

	// Sort draft list by availability: Available first, Unknown second, Drafted last
	// When a preset is active, apply preset filtering/sorting first, then group by availability
	const sortedDraftList = React.useMemo(() => {
		// Use currentListPlayers which is already filtered by tier and list name
		const tierList = currentListPlayers;
		
		// Get player stats for filtering/sorting
		let playersWithStats = tierList.map(playerName => {
			const stats = tierPlayers.find(p => p.name === playerName);
			return { playerName, stats };
		});
		
		// Apply preset filters and sorting if one is selected
		if (activePreset) {
			// Team filter
			if (activePreset.teamFilter) {
				playersWithStats = playersWithStats.filter(({ playerName, stats }) => 
					stats && getPlayerTeamDisplay(playerName, stats.team, playersData) === activePreset.teamFilter
				);
			}
			// Min games filter
			if (activePreset.minGames > 0) {
				playersWithStats = playersWithStats.filter(({ stats }) => 
					stats && (stats.gameCount || 0) >= activePreset.minGames
				);
			}
			// Stat filters
			activePreset.statFilters.forEach(filter => {
				playersWithStats = playersWithStats.filter(({ playerName, stats }) => {
					if (!stats) return false;
					let val: number | undefined;
					if (filter.stat === "ecoRating") {
						val = ecoRatingMap[playerName.toLowerCase()];
					} else if (filter.stat.startsWith("mapRating_")) {
						const mapName = filter.stat.replace("mapRating_", "") as MapName;
						val = ecoDataMap[playerName.toLowerCase()]?.mapData?.[mapName]?.rating;
					} else if (filter.stat.startsWith("mapGames_")) {
						const mapName = filter.stat.replace("mapGames_", "") as MapName;
						val = ecoDataMap[playerName.toLowerCase()]?.mapData?.[mapName]?.gamesPlayed;
					} else {
						val = stats[filter.stat as keyof CscStats] as number | undefined;
					}
					if (val === undefined) return false;
					switch (filter.operator) {
						case "<": return val < filter.value;
						case ">": return val > filter.value;
						case "<=": return val <= filter.value;
						case ">=": return val >= filter.value;
						case "=": return val === filter.value;
						default: return true;
					}
				});
			});
			
			// Sort by preset's sort column
			playersWithStats.sort((a, b) => {
				let aVal: string | number | undefined;
				let bVal: string | number | undefined;
				
				if (activePreset.sortColumn === "name") {
					aVal = a.playerName.toLowerCase();
					bVal = b.playerName.toLowerCase();
				} else if (activePreset.sortColumn === "team") {
					aVal = (a.stats?.team || "").toLowerCase();
					bVal = (b.stats?.team || "").toLowerCase();
				} else if (activePreset.sortColumn === "ecoRating") {
					aVal = ecoRatingMap[a.playerName.toLowerCase()];
					bVal = ecoRatingMap[b.playerName.toLowerCase()];
				} else if (activePreset.sortColumn === "ecoRatingDiff") {
					const aEco = ecoRatingMap[a.playerName.toLowerCase()];
					const bEco = ecoRatingMap[b.playerName.toLowerCase()];
					aVal = (aEco !== undefined && a.stats?.rating) ? ((aEco - a.stats.rating) / a.stats.rating) * 100 : undefined;
					bVal = (bEco !== undefined && b.stats?.rating) ? ((bEco - b.stats.rating) / b.stats.rating) * 100 : undefined;
				} else if (activePreset.sortColumn.startsWith("mapRating_")) {
					const mapName = activePreset.sortColumn.replace("mapRating_", "") as MapName;
					aVal = ecoDataMap[a.playerName.toLowerCase()]?.mapData?.[mapName]?.rating;
					bVal = ecoDataMap[b.playerName.toLowerCase()]?.mapData?.[mapName]?.rating;
				} else if (activePreset.sortColumn.startsWith("mapGames_")) {
					const mapName = activePreset.sortColumn.replace("mapGames_", "") as MapName;
					aVal = ecoDataMap[a.playerName.toLowerCase()]?.mapData?.[mapName]?.gamesPlayed;
					bVal = ecoDataMap[b.playerName.toLowerCase()]?.mapData?.[mapName]?.gamesPlayed;
				} else {
					aVal = a.stats?.[activePreset.sortColumn as keyof CscStats] as number | undefined;
					bVal = b.stats?.[activePreset.sortColumn as keyof CscStats] as number | undefined;
				}
				
				if (aVal === undefined && bVal === undefined) return 0;
				if (aVal === undefined) return 1;
				if (bVal === undefined) return -1;
				
				let comparison = 0;
				if (typeof aVal === "string" && typeof bVal === "string") {
					comparison = aVal.localeCompare(bVal);
				} else {
					comparison = (aVal as number) - (bVal as number);
				}
				
				return activePreset.sortDirection === "asc" ? comparison : -comparison;
			});
		}
		
		// Group players by availability status while preserving order within each group
		const available: string[] = [];
		const unknown: string[] = [];
		const drafted: string[] = [];
		
		playersWithStats.forEach(({ playerName }) => {
			const status = draftStatusMap[playerName.toLowerCase()];
			if (status === false) {
				available.push(playerName);
			} else if (status === undefined) {
				unknown.push(playerName);
			} else {
				drafted.push(playerName);
			}
		});
		
		return [...available, ...unknown, ...drafted];
	}, [currentListPlayers, draftStatusMap, activePreset, tierPlayers, playersData, ecoRatingMap, ecoDataMap]);

	// Helper to check if player can move up within their availability group
	const canMoveUp = (playerName: string, index: number): boolean => {
		if (index === 0) return false;
		const prevPlayer = sortedDraftList[index - 1];
		const currentStatus = draftStatusMap[playerName.toLowerCase()];
		const prevStatus = draftStatusMap[prevPlayer.toLowerCase()];
		// Can only move up if previous player has same availability status
		return currentStatus === prevStatus;
	};

	// Helper to check if player can move down within their availability group
	const canMoveDown = (playerName: string, index: number): boolean => {
		if (index === sortedDraftList.length - 1) return false;
		const nextPlayer = sortedDraftList[index + 1];
		const currentStatus = draftStatusMap[playerName.toLowerCase()];
		const nextStatus = draftStatusMap[nextPlayer.toLowerCase()];
		// Can only move down if next player has same availability status
		return currentStatus === nextStatus;
	};

	const isLoading = isLoadingFranchises || isLoadingStats || isLoadingExtendedStats;

	if (isLoading) {
		return <Loading />;
	}

	const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "Never";

	const handleExport = () => {
		handleExportSettings(
			selectedFranchise,
			playerTargets,
			playerRoles,
			selectedStats,
			sectionOrder,
			hiddenSections,
			collapsedSections,
			scoutingNotes,
			colorblindMode,
			colorblindColors,
			tableViewFilterPresets,
			myDraftList
		);
	};

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleImportSettings = createImportHandler(
		setPlayerTargets,
		setPlayerRoles,
		setSelectedStats,
		setSelectedFranchise,
		setSectionOrder,
		setHiddenSections,
		setCollapsedSections,
		setScoutingNotes,
		setColorblindMode,
		setColorblindColors,
		setTableViewFilterPresets,
		setMyDraftList
	);

	const handleClearFranchise = () => {
		setSelectedFranchise("");
	};

	return (
		<div className="flex min-h-screen bg-gray-900">
			<GMSidebar
				currentFranchise={currentFranchise}
				currentPage="draftlist"
				onExport={handleExport}
				onImport={handleImportClick}
				onChangeFranchise={handleClearFranchise}
				fileInputRef={fileInputRef}
				onFileChange={handleImportSettings}
				colorblindMode={colorblindMode === "true"}
				onToggleColorblindMode={() => setColorblindMode(colorblindMode === "true" ? "false" : "true")}
				colorblindColors={parseColorblindColors(colorblindColors)}
				onColorblindColorsChange={(colors) => setColorblindColors(JSON.stringify(colors))}
			/>

			<div className="flex-1 p-6 overflow-auto">
				<div className="mb-6">
					<h1 className="text-3xl font-bold text-white mb-2">Draft List</h1>
					<p className="text-gray-400">
						Real-time draft availability tracker
						{isUsingFallback && (
							<span className="ml-2 text-yellow-400">(Using Season {effectiveSeason} data)</span>
						)}
					</p>
				</div>

				{/* Controls */}
				<div className="bg-gray-800 rounded-lg p-4 mb-6">
					<div className="flex flex-wrap gap-4 items-center">
						{/* Tier Selection */}
						<div>
							<label className="block text-sm font-medium text-gray-400 mb-1">Tier</label>
							<select
								value={selectedTier}
								onChange={(e) => setSelectedTier(e.target.value)}
								className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
							>
								{availableTiers.map(tier => (
									<option key={tier} value={tier}>{tier}</option>
								))}
							</select>
						</div>

						{/* Search */}
						<div className="flex-1 min-w-[200px]">
							<label className="block text-sm font-medium text-gray-400 mb-1">Search Player</label>
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search by name..."
								className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
							/>
						</div>

						{/* Filter */}
						<div>
							<label className="block text-sm font-medium text-gray-400 mb-1">Show</label>
							<select
								value={showDraftedOnly}
								onChange={(e) => setShowDraftedOnly(e.target.value as "all" | "available" | "drafted")}
								className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
							>
								<option value="all">All Players</option>
								<option value="available">Available Only</option>
								<option value="drafted">Drafted Only</option>
							</select>
						</div>

						{/* Saved Filter Preset */}
						<div>
							<label className="block text-sm font-medium text-gray-400 mb-1">Filter Preset</label>
							<select
								value={selectedPreset}
								onChange={(e) => setSelectedPreset(e.target.value)}
								className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 min-w-[150px]"
							>
								<option value="">No Preset</option>
								{parsedPresets.filter(p => !p.statsSource || p.statsSource === "csc").length > 0 && (
									<optgroup label="CSC Stats">
										{parsedPresets.filter(p => !p.statsSource || p.statsSource === "csc").map(preset => (
											<option key={preset.name} value={preset.name}>{preset.name}</option>
										))}
									</optgroup>
								)}
								{parsedPresets.filter(p => p.statsSource === "extended").length > 0 && (
									<optgroup label="Extended Stats">
										{parsedPresets.filter(p => p.statsSource === "extended").map(preset => (
											<option key={preset.name} value={preset.name}>{preset.name}</option>
										))}
									</optgroup>
								)}
							</select>
						</div>

						{/* Auto Refresh Toggle */}
						<div>
							<label className="block text-sm font-medium text-gray-400 mb-1">Auto Refresh</label>
							<button
								onClick={() => setAutoRefresh(!autoRefresh)}
								className={`px-4 py-2 rounded-lg font-medium transition-colors ${
									autoRefresh 
										? "bg-green-600 hover:bg-green-700 text-white" 
										: "bg-gray-600 hover:bg-gray-500 text-gray-300"
								}`}
							>
								{autoRefresh ? "ON" : "OFF"}
							</button>
						</div>

						{/* Manual Refresh */}
						<div>
							<label className="block text-sm font-medium text-gray-400 mb-1">Refresh</label>
							<button
								onClick={() => refetchDraftStatus()}
								disabled={isLoadingDraftStatus}
								className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
							>
								{isLoadingDraftStatus ? "Loading..." : "Refresh Now"}
							</button>
						</div>
					</div>

					{/* Status Bar */}
					<div className="mt-4 flex flex-wrap gap-4 items-center text-sm">
						<span className="text-gray-400">
							Last updated: <span className="text-white">{lastUpdated}</span>
						</span>
						<span className="text-gray-400">|</span>
						<span className="text-green-400">
							Available: <span className="font-bold">{playerCounts.available}</span>
						</span>
						<span className="text-red-400">
							Drafted: <span className="font-bold">{playerCounts.drafted}</span>
						</span>
						{playerCounts.unknown > 0 && (
							<span className="text-yellow-400">
								Unknown: <span className="font-bold">{playerCounts.unknown}</span>
							</span>
						)}
						<span className="text-gray-400">
							Total: <span className="font-bold">{playerCounts.total}</span>
						</span>
					</div>
				</div>

				{/* Two Column Layout */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Left Column: Tier Players */}
					<div className="bg-gray-800 rounded-lg overflow-hidden">
						<div className="px-4 py-3 bg-gray-750 border-b border-gray-700">
							<h2 className="text-lg font-semibold text-white">
								{selectedTier} Players
								<span className="ml-2 text-sm font-normal text-gray-400">
									({filteredPlayers.length} players)
								</span>
							</h2>
						</div>
						<div className="overflow-y-auto max-h-[600px]">
							<table className="w-full">
								<thead className="bg-gray-750 sticky top-0">
									<tr>
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-300 w-20">Status</th>
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-300">Player</th>
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300 w-16">Rating</th>
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300 w-20">Eco Rating</th>
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300 w-12">Stats</th>
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300 w-14">Similar</th>
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300 w-16">Action</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-700">
									{filteredPlayers.length === 0 ? (
										<tr>
											<td colSpan={7} className="px-4 py-8 text-center text-gray-400">
												No players found
											</td>
										</tr>
									) : (
										filteredPlayers.map(player => {
											const isDrafted = draftStatusMap[player.name.toLowerCase()];
											const statusKnown = isDrafted !== undefined;
											const isInMyList = isPlayerInMyDraftList(player.name);
											const playerDraftTier = getPlayerDraftListTier(player.name);
											
											return (
												<React.Fragment key={player.name}>
												<tr 
													className={`hover:bg-gray-750 transition-colors ${
														isDrafted ? "opacity-50" : ""
													}`}
												>
													<td className="px-3 py-2">
														{!statusKnown ? (
															<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">
																?
															</span>
														) : isDrafted ? (
															<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300">
																Drafted
															</span>
														) : (
															<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
																Available
															</span>
														)}
													</td>
													<td className="px-3 py-2">
														<div className={`font-medium text-sm ${isDrafted ? "text-gray-500" : "text-white"}`}>
															{player.name}
														</div>
														<div className="text-xs text-gray-500">
															{getPlayerTeamDisplay(player.name, player.team, playersData)}
														</div>
														{/* Map Stats - always visible */}
														{(() => {
															const ecoData = ecoDataMap[player.name.toLowerCase()];
															const mapsWithData = mapNames
																.filter(m => 
																	ecoData?.mapData?.[m]?.rating !== undefined || 
																	ecoData?.mapData?.[m]?.gamesPlayed !== undefined
																)
																.sort((a, b) => {
																	const aRating = ecoData?.mapData?.[a]?.rating ?? -1;
																	const bRating = ecoData?.mapData?.[b]?.rating ?? -1;
																	return bRating - aRating;
																});
															if (mapsWithData.length === 0) return null;
															return (
																<div className="flex flex-wrap gap-1 mt-1">
																	{mapsWithData.map(mapName => {
																		const mapData = ecoData?.mapData?.[mapName];
																		return (
																			<span key={mapName} className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
																				{formatMapName(mapName)}: {mapData?.rating?.toFixed(2) || "-"}
																				<span className="text-gray-600">({mapData?.gamesPlayed || 0})</span>
																			</span>
																		);
																	})}
																</div>
															);
														})()}
													</td>
													<td className="px-3 py-2 text-center text-sm text-gray-300">
														{player.rating?.toFixed(2) || "-"}
													</td>
													<td className="px-3 py-2 text-center text-sm text-cyan-400">
														{ecoRatingMap[player.name.toLowerCase()]?.toFixed(2) || "-"}
													</td>
													<td className="px-3 py-2 text-center">
														<button
															onClick={() => setStatsPopupPlayer(statsPopupPlayer === player.name ? null : player.name)}
															className={`px-2 py-1 text-xs rounded transition-colors ${statsPopupPlayer === player.name ? 'bg-cyan-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}
															title="View tracked stats"
														>
															📊
														</button>
													</td>
													<td className="px-3 py-2 text-center">
														<button
															onClick={() => setSimilarPlayerTarget(similarPlayerTarget === player.name ? null : player.name)}
															className={`px-2 py-1 text-xs rounded transition-colors ${similarPlayerTarget === player.name ? 'bg-purple-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}
															title="Find similar players"
														>
															🔍
														</button>
													</td>
													<td className="px-3 py-2 text-center whitespace-nowrap">
														{isInMyList ? (
															<button
																onClick={() => {
																	const listName = getPlayerDraftListName(player.name, playerDraftTier!);
																	if (listName) removeFromMyDraftList(player.name, playerDraftTier!, listName);
																}}
																className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
																title="Remove from my list"
															>
																Remove
															</button>
														) : (
															<button
																onClick={() => addToMyDraftList(player.name, selectedTier, selectedDraftListName)}
																className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
																title="Add to my draft list"
															>
																+ Add
															</button>
														)}
													</td>
												</tr>
												{/* Inline Stats Row */}
												{statsPopupPlayer === player.name && (
													<tr className="bg-gray-750/50">
														<td colSpan={7} className="px-3 py-2">
															<div className="flex flex-wrap gap-3 text-xs mb-2">
																{trackedStats.length === 0 ? (
																	<span className="text-gray-500">No stats being tracked. Configure in Set Targets.</span>
																) : (
																	trackedStats.map(stat => {
																		const value = player[stat.key] as number | undefined;
																		return (
																			<div key={stat.key} className="flex items-center gap-1">
																				<span className="text-gray-400">{stat.label}:</span>
																				<span className="text-white font-medium">
																					{value !== undefined 
																						? (typeof value === "number" && !Number.isInteger(value) ? value.toFixed(2) : value)
																						: "-"
																					}
																				</span>
																			</div>
																		);
																	})
																)}
															</div>
															{/* Map Stats */}
															{(() => {
																const ecoData = ecoDataMap[player.name.toLowerCase()];
																const mapsWithData = mapNames.filter(m => 
																	ecoData?.mapData?.[m]?.rating !== undefined || 
																	ecoData?.mapData?.[m]?.gamesPlayed !== undefined
																);
																if (mapsWithData.length === 0) return null;
																return (
																	<div className="flex flex-wrap gap-2 text-xs border-t border-gray-700 pt-2">
																		<span className="text-gray-500 mr-1">Maps:</span>
																		{mapsWithData.map(mapName => {
																			const mapData = ecoData?.mapData?.[mapName];
																			return (
																				<span key={mapName} className="px-2 py-0.5 bg-gray-700 rounded text-gray-300">
																					{formatMapName(mapName)}: {mapData?.rating?.toFixed(2) || "-"}
																					{mapData?.gamesPlayed !== undefined && (
																						<span className="text-gray-500 ml-1">({mapData.gamesPlayed}g)</span>
																					)}
																				</span>
																			);
																		})}
																	</div>
																);
															})()}
														</td>
													</tr>
												)}
											</React.Fragment>
											);
										})
									)}
								</tbody>
							</table>
						</div>

						{/* Similar Players Panel */}
						{similarPlayerTarget && (
							<div className="border-t border-gray-700 bg-purple-900/20">
								<div className="px-4 py-3 bg-purple-900/30 border-b border-purple-700 flex justify-between items-center">
									<h3 className="text-sm font-semibold text-purple-300">
										🔍 Players Similar to {similarPlayerTarget}
										<span className="ml-2 text-xs font-normal text-purple-400">
											({similarPlayers.length} found)
										</span>
									</h3>
									<button
										onClick={() => setSimilarPlayerTarget(null)}
										className="text-purple-400 hover:text-purple-200 transition-colors"
									>
										✕
									</button>
								</div>
								<div className="max-h-[300px] overflow-y-auto">
									{similarPlayers.length === 0 ? (
										<div className="px-4 py-6 text-center text-gray-400 text-sm">
											No similar players found. Try tracking more stats in Set Targets.
										</div>
									) : (
										<table className="w-full">
											<thead className="bg-purple-900/30 sticky top-0">
												<tr>
													<th className="px-3 py-2 text-left text-xs font-semibold text-purple-300">#</th>
													<th className="px-3 py-2 text-left text-xs font-semibold text-purple-300">Player</th>
													<th className="px-3 py-2 text-center text-xs font-semibold text-purple-300">Status</th>
													{trackedStats.slice(0, 4).map(stat => (
														<th key={stat.key} className="px-3 py-2 text-center text-xs font-semibold text-purple-300">
															{stat.label}
														</th>
													))}
													<th className="px-3 py-2 text-center text-xs font-semibold text-purple-300">Action</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-purple-800/50">
												{similarPlayers.map((item, idx) => {
													const isDrafted = draftStatusMap[item.player.name.toLowerCase()];
													const statusKnown = isDrafted !== undefined;
													const isInList = isPlayerInMyDraftList(item.player.name);
													
													return (
														<tr key={item.player.name} className={`hover:bg-purple-900/30 ${isDrafted ? 'opacity-50' : ''}`}>
															<td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
															<td className="px-3 py-2">
																<div className={`font-medium text-sm ${isDrafted ? 'text-gray-500' : 'text-white'}`}>
																	{item.player.name}
																</div>
																<div className="text-xs text-gray-500">
																	{getPlayerTeamDisplay(item.player.name, item.player.team, playersData)}
																</div>
															</td>
															<td className="px-3 py-2 text-center">
																{!statusKnown ? (
																	<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">?</span>
																) : isDrafted ? (
																	<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300">Drafted</span>
																) : (
																	<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">Available</span>
																)}
															</td>
															{trackedStats.slice(0, 4).map(stat => {
																const value = item.player[stat.key as keyof CscStats] as number | undefined;
																const targetPlayer = tierPlayers.find(p => p.name === similarPlayerTarget);
																const targetVal = targetPlayer?.[stat.key as keyof CscStats] as number | undefined;
																const isBetter = value !== undefined && targetVal !== undefined && value >= targetVal;
																
																return (
																	<td key={stat.key} className={`px-3 py-2 text-center text-xs ${isBetter ? 'text-green-400' : 'text-gray-300'}`}>
																		{value !== undefined ? (typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value) : '-'}
																	</td>
																);
															})}
															<td className="px-3 py-2 text-center">
																{isInList ? (
																	<span className="text-xs text-gray-500">In List</span>
																) : (
																	<button
																		onClick={() => addToMyDraftList(item.player.name, selectedTier)}
																		className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
																	>
																		+ Add
																	</button>
																)}
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									)}
								</div>
							</div>
						)}
					</div>

					{/* Right Column: My Draft List for Selected Tier */}
					<div className="bg-gray-800 rounded-lg overflow-hidden">
						<div className="px-4 py-3 bg-gray-750 border-b border-gray-700">
							<div className="flex justify-between items-center mb-2">
								<h2 className="text-lg font-semibold text-white">
									My {selectedTier} Draft Lists
								</h2>
								<button
									onClick={() => setShowNewListModal(true)}
									className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center gap-1"
									title="Create new list"
								>
									<span>+</span> New List
								</button>
							</div>
							<div className="flex items-center gap-2">
								<select
									value={selectedDraftListName}
									onChange={(e) => setSelectedDraftListName(e.target.value)}
									className="flex-1 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
								>
									{availableListNames.map(name => (
										<option key={name} value={name}>{name}</option>
									))}
								</select>
								<span className="text-sm text-gray-400">
									({currentListPlayers.length} players)
								</span>
								{currentListPlayers.length > 0 && (
									<button
										onClick={() => clearTierDraftList(selectedTier, selectedDraftListName)}
										className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
										title="Clear this list"
									>
										Clear
									</button>
								)}
								{availableListNames.length > 1 && (
									<button
										onClick={() => deleteDraftList(selectedTier, selectedDraftListName)}
										className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
										title="Delete this list"
									>
										×
									</button>
								)}
							</div>
						</div>
						<div className="overflow-y-auto max-h-[600px]">
							{sortedDraftList.length === 0 ? (
								<div className="px-4 py-8 text-center text-gray-400">
									<p>No players in "{selectedDraftListName}"</p>
									<p className="text-sm mt-2">Add players from the tier list on the left</p>
								</div>
							) : (
								<div className="divide-y divide-gray-700">
									{sortedDraftList.map((playerName, index) => {
										const playerStats = tierPlayers.find(p => p.name === playerName);
										const isDrafted = draftStatusMap[playerName.toLowerCase()];
										const statusKnown = isDrafted !== undefined;
										const scoutingNote = getScoutingNote(playerName, selectedTier);
										const hasScoutingData = scoutingNote && (scoutingNote.playstyle || scoutingNote.role || scoutingNote.commsRating || scoutingNote.notes);
										const actualTier = getPlayerActualTier(playerName);
										// Tier mismatch if player is in a different tier, OR if player is no longer found in any tier
										const tierMismatch = actualTier !== selectedTier;
										
										return (
											<div
												key={playerName}
												className={`px-4 py-3 hover:bg-gray-750 transition-all ${
													tierMismatch ? "bg-orange-900/30 border-l-4 border-orange-500" : isDrafted ? "bg-red-900/20" : ""
												}`}
											>
												<div className="flex items-center gap-3">
													{/* Rank/Order */}
													<div className="flex items-center justify-center">
														<span className="text-lg font-bold text-gray-500 w-6 text-center">{index + 1}</span>
													</div>

													{/* Player Info */}
													<div className="flex-1 min-w-0">
														<div className={`font-medium ${tierMismatch ? "text-orange-400" : isDrafted ? "text-gray-500 line-through" : "text-white"}`}>
															{playerName}
															{hasScoutingData && (
																<span className="ml-2 text-xs text-cyan-400" title="Has scouting notes">📋</span>
															)}
														</div>
														{tierMismatch && (
															<div className="text-xs font-semibold text-orange-400 flex items-center gap-1">
																<span>⚠️</span>
																<span>{actualTier ? `Now in ${actualTier}` : "No longer in any tier"} - Cannot draft in {selectedTier}</span>
															</div>
														)}
														<div className="text-xs text-gray-500">
															{playerStats && <>Rating: {playerStats.rating?.toFixed(2)} | </>}
															{ecoRatingMap[playerName.toLowerCase()] !== undefined && <>Eco: {ecoRatingMap[playerName.toLowerCase()]?.toFixed(2)}{playerStats && " | "}</>}
															{playerStats && <>ADR: {playerStats.adr?.toFixed(1)}</>}
														</div>
														{/* Map Stats - always visible */}
														{(() => {
															const ecoData = ecoDataMap[playerName.toLowerCase()];
															const mapsWithData = mapNames
																.filter(m => 
																	ecoData?.mapData?.[m]?.rating !== undefined || 
																	ecoData?.mapData?.[m]?.gamesPlayed !== undefined
																)
																.sort((a, b) => {
																	const aRating = ecoData?.mapData?.[a]?.rating ?? -1;
																	const bRating = ecoData?.mapData?.[b]?.rating ?? -1;
																	return bRating - aRating;
																});
															if (mapsWithData.length === 0) return null;
															return (
																<div className="flex flex-wrap gap-1 mt-1">
																	{mapsWithData.map(mapName => {
																		const mapData = ecoData?.mapData?.[mapName];
																		return (
																			<span key={mapName} className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
																				{formatMapName(mapName)}: {mapData?.rating?.toFixed(2) || "-"}
																				<span className="text-gray-600">({mapData?.gamesPlayed || 0})</span>
																			</span>
																		);
																	})}
																</div>
															);
														})()}
													</div>

													{/* Status */}
													<div>
														{!statusKnown ? (
															<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">
																Unknown
															</span>
														) : isDrafted ? (
															<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900 text-red-300">
																Drafted
															</span>
														) : (
															<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-300">
																Available
															</span>
														)}
													</div>

													{/* Stats Button */}
													<button
														onClick={() => setStatsPopupPlayer(statsPopupPlayer === playerName ? null : playerName)}
														className={`px-2 py-1 text-xs rounded transition-colors ${statsPopupPlayer === playerName ? 'bg-cyan-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}
														title="View tracked stats"
													>
														📊
													</button>

													{/* Move Up/Down Buttons */}
													<div className="flex flex-col gap-0.5">
														<button
															onClick={() => movePlayerUp(playerName, selectedTier)}
															disabled={!canMoveUp(playerName, index)}
															className={`p-0.5 rounded transition-colors ${canMoveUp(playerName, index) ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-700 cursor-not-allowed'}`}
															title="Move up"
														>
															<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
																<path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
															</svg>
														</button>
														<button
															onClick={() => movePlayerDown(playerName, selectedTier)}
															disabled={!canMoveDown(playerName, index)}
															className={`p-0.5 rounded transition-colors ${canMoveDown(playerName, index) ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-700 cursor-not-allowed'}`}
															title="Move down"
														>
															<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
																<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
															</svg>
														</button>
													</div>

													{/* Remove Button */}
													<button
														onClick={() => removeFromMyDraftList(playerName, selectedTier)}
														className="p-1 text-gray-500 hover:text-red-400 transition-colors"
														title="Remove from list"
													>
														<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
															<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
														</svg>
													</button>
												</div>

												{/* Inline Stats Section */}
												{statsPopupPlayer === playerName && (
													<div className="mt-2 ml-9 p-2 bg-cyan-900/20 rounded-lg border border-cyan-700">
														<div className="flex flex-wrap gap-3 text-xs mb-2">
															{trackedStats.length === 0 ? (
																<span className="text-gray-500">No stats being tracked. Configure in Set Targets.</span>
															) : (
																trackedStats.map(stat => {
																	const value = playerStats?.[stat.key] as number | undefined;
																	return (
																		<div key={stat.key} className="flex items-center gap-1">
																			<span className="text-gray-400">{stat.label}:</span>
																			<span className="text-white font-medium">
																				{value !== undefined 
																					? (typeof value === "number" && !Number.isInteger(value) ? value.toFixed(2) : value)
																					: "-"
																				}
																			</span>
																		</div>
																	);
																})
															)}
														</div>
														{/* Map Stats */}
														{(() => {
															const ecoData = ecoDataMap[playerName.toLowerCase()];
															const mapsWithData = mapNames.filter(m => 
																ecoData?.mapData?.[m]?.rating !== undefined || 
																ecoData?.mapData?.[m]?.gamesPlayed !== undefined
															);
															if (mapsWithData.length === 0) return null;
															return (
																<div className="flex flex-wrap gap-2 text-xs border-t border-cyan-700 pt-2">
																	<span className="text-gray-500 mr-1">Maps:</span>
																	{mapsWithData.map(mapName => {
																		const mapData = ecoData?.mapData?.[mapName];
																		return (
																			<span key={mapName} className="px-2 py-0.5 bg-gray-700 rounded text-gray-300">
																				{formatMapName(mapName)}: {mapData?.rating?.toFixed(2) || "-"}
																				{mapData?.gamesPlayed !== undefined && (
																					<span className="text-gray-500 ml-1">({mapData.gamesPlayed}g)</span>
																				)}
																			</span>
																		);
																	})}
																</div>
															);
														})()}
													</div>
												)}

												{/* Scouting Notes Section */}
												{hasScoutingData && (
													<div className="mt-2 ml-9 p-2 bg-gray-900/50 rounded-lg border border-gray-700">
														<div className="flex flex-wrap gap-2 mb-1">
															{scoutingNote.role && (
																<span className="px-2 py-0.5 text-xs rounded bg-cyan-900/50 text-cyan-300 border border-cyan-700">
																	{scoutingNote.role}
																</span>
															)}
															{scoutingNote.playstyle && (
																<span className={`px-2 py-0.5 text-xs rounded border ${
																	scoutingNote.playstyle === "Aggressive" 
																		? "bg-red-900/50 text-red-300 border-red-700" 
																		: "bg-blue-900/50 text-blue-300 border-blue-700"
																}`}>
																	{scoutingNote.playstyle}
																</span>
															)}
															{scoutingNote.commsRating && (
																<span className={`px-2 py-0.5 text-xs rounded border ${
																	scoutingNote.commsRating === "Excellent" || scoutingNote.commsRating === "Great"
																		? "bg-green-900/50 text-green-300 border-green-700"
																		: scoutingNote.commsRating === "Normal"
																			? "bg-gray-700/50 text-gray-300 border-gray-600"
																			: "bg-orange-900/50 text-orange-300 border-orange-700"
																}`}>
																	Comms: {scoutingNote.commsRating}
																</span>
															)}
														</div>
														{scoutingNote.notes && (
															<p className="text-xs text-gray-400 italic">"{scoutingNote.notes}"</p>
														)}
													</div>
												)}
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* New List Modal */}
			{showNewListModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-700">
						<h3 className="text-lg font-bold text-white mb-4">Create New Draft List</h3>
						<p className="text-sm text-gray-400 mb-4">
							Create a new list for {selectedTier} to organize players by category (e.g., "Priority", "Backup", "Watch List")
						</p>
						<input
							type="text"
							placeholder="Enter list name..."
							value={newListName}
							onChange={(e) => setNewListName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && createNewDraftList(newListName)}
							className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
							autoFocus
						/>
						<div className="flex gap-2 justify-end">
							<button
								onClick={() => {
									setShowNewListModal(false);
									setNewListName("");
								}}
								className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={() => createNewDraftList(newListName)}
								disabled={!newListName.trim()}
								className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
							>
								Create
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
