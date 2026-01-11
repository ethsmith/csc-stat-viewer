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
import { useEcoRatings } from "./hooks/useEcoRatings";
import { useDraftStatus } from "./hooks/useDraftStatus";

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

	// Filter preset type matching tableView
	type FilterPreset = {
		name: string;
		teamFilter: string;
		minGames: number;
		statFilters: Array<{ stat: keyof CscStats | "ecoRating"; operator: "<" | ">" | "<=" | ">=" | "="; value: number }>;
		sortColumn: keyof CscStats | "name" | "team" | "ecoRating";
		sortDirection: "asc" | "desc";
	};

	const parsedPresets: FilterPreset[] = React.useMemo(() => {
		try {
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

	// Parse my draft list from localStorage - now keyed by tier
	const parsedMyDraftList: Record<string, string[]> = React.useMemo(() => {
		try {
			return JSON.parse(myDraftList);
		} catch {
			return {};
		}
	}, [myDraftList]);

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

	// Add player to my draft list for the current tier
	const addToMyDraftList = (playerName: string, tier: string) => {
		const tierList = parsedMyDraftList[tier] || [];
		if (!tierList.includes(playerName)) {
			const newList = { ...parsedMyDraftList, [tier]: [...tierList, playerName] };
			setMyDraftList(JSON.stringify(newList));
		}
	};

	// Remove player from my draft list
	const removeFromMyDraftList = (playerName: string, tier: string) => {
		const tierList = parsedMyDraftList[tier] || [];
		const newTierList = tierList.filter(name => name !== playerName);
		const newList = { ...parsedMyDraftList, [tier]: newTierList };
		setMyDraftList(JSON.stringify(newList));
	};

	// Check if player is in any tier's draft list
	const isPlayerInMyDraftList = (playerName: string): boolean => {
		return Object.values(parsedMyDraftList).some(tierList => tierList.includes(playerName));
	};

	// Get which tier a player is in (for the draft list)
	const getPlayerDraftListTier = (playerName: string): string | null => {
		for (const [tier, players] of Object.entries(parsedMyDraftList)) {
			if (players.includes(playerName)) return tier;
		}
		return null;
	};

	// Clear all players from a specific tier
	const clearTierDraftList = (tier: string) => {
		const newList = { ...parsedMyDraftList, [tier]: [] };
		setMyDraftList(JSON.stringify(newList));
	};

	// Move player up in the draft list (within their availability group)
	const movePlayerUp = (playerName: string, tier: string) => {
		const tierList = parsedMyDraftList[tier] || [];
		const index = tierList.indexOf(playerName);
		if (index > 0) {
			const newTierList = [...tierList];
			[newTierList[index - 1], newTierList[index]] = [newTierList[index], newTierList[index - 1]];
			const newList = { ...parsedMyDraftList, [tier]: newTierList };
			setMyDraftList(JSON.stringify(newList));
		}
	};

	// Move player down in the draft list (within their availability group)
	const movePlayerDown = (playerName: string, tier: string) => {
		const tierList = parsedMyDraftList[tier] || [];
		const index = tierList.indexOf(playerName);
		if (index < tierList.length - 1) {
			const newTierList = [...tierList];
			[newTierList[index], newTierList[index + 1]] = [newTierList[index + 1], newTierList[index]];
			const newList = { ...parsedMyDraftList, [tier]: newTierList };
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
	const { ecoRatingMap } = useEcoRatings();

	const currentFranchise = franchises.find((f: Franchise) => f.prefix === selectedFranchise);

	const availableTiers = React.useMemo(() => {
		if (!statsCache?.data) return [];
		return Object.keys(statsCache.data).filter(tier => {
			const tierStats = statsCache.data[tier as keyof typeof statsCache.data];
			return tierStats && tierStats.length > 0;
		});
	}, [statsCache]);

	React.useEffect(() => {
		if (availableTiers.length > 0 && !selectedTier) {
			setSelectedTier(availableTiers[0]);
		}
	}, [availableTiers, selectedTier]);

	const tierPlayers: CscStats[] = React.useMemo(() => {
		if (!statsCache?.data || !selectedTier) return [];
		return statsCache.data[selectedTier as keyof typeof statsCache.data] || [];
	}, [statsCache, selectedTier]);

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
					} else {
						val = p[filter.stat] as number | undefined;
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
				} else {
					aVal = a[activePreset.sortColumn] as number | undefined;
					bVal = b[activePreset.sortColumn] as number | undefined;
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
	}, [tierPlayers, searchQuery, showDraftedOnly, draftStatusMap, playerTypeMap, activePreset, playersData, ecoRatingMap]);

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
		const tierList = parsedMyDraftList[selectedTier] || [];
		
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
					} else {
						val = stats[filter.stat] as number | undefined;
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
				} else {
					aVal = a.stats?.[activePreset.sortColumn] as number | undefined;
					bVal = b.stats?.[activePreset.sortColumn] as number | undefined;
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
	}, [parsedMyDraftList, selectedTier, draftStatusMap, activePreset, tierPlayers, playersData, ecoRatingMap]);

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

	const isLoading = isLoadingFranchises || isLoadingStats;

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
								{parsedPresets.map(preset => (
									<option key={preset.name} value={preset.name}>{preset.name}</option>
								))}
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
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-300">Status</th>
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-300">Player</th>
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300">Rating</th>
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300">Eco Rating</th>
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300">Stats</th>
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300">Similar</th>
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300">Action</th>
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
													<td className="px-3 py-2 text-center">
														{isInMyList ? (
															<button
																onClick={() => removeFromMyDraftList(player.name, playerDraftTier!)}
																className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
																title="Remove from my list"
															>
																Remove
															</button>
														) : (
															<button
																onClick={() => addToMyDraftList(player.name, selectedTier)}
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
														<td colSpan={6} className="px-3 py-2">
															<div className="flex flex-wrap gap-3 text-xs">
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
						<div className="px-4 py-3 bg-gray-750 border-b border-gray-700 flex justify-between items-center">
							<h2 className="text-lg font-semibold text-white">
								My {selectedTier} Draft List
								<span className="ml-2 text-sm font-normal text-gray-400">
									({(parsedMyDraftList[selectedTier] || []).length} players)
								</span>
							</h2>
							{(parsedMyDraftList[selectedTier] || []).length > 0 && (
								<button
									onClick={() => clearTierDraftList(selectedTier)}
									className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
								>
									Clear
								</button>
							)}
						</div>
						<div className="overflow-y-auto max-h-[600px]">
							{sortedDraftList.length === 0 ? (
								<div className="px-4 py-8 text-center text-gray-400">
									<p>No players in your {selectedTier} draft list</p>
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
										
										return (
											<div
												key={playerName}
												className={`px-4 py-3 hover:bg-gray-750 transition-all ${
													isDrafted ? "bg-red-900/20" : ""
												}`}
											>
												<div className="flex items-center gap-3">
													{/* Rank/Order */}
													<div className="flex items-center justify-center">
														<span className="text-lg font-bold text-gray-500 w-6 text-center">{index + 1}</span>
													</div>

													{/* Player Info */}
													<div className="flex-1 min-w-0">
														<div className={`font-medium ${isDrafted ? "text-gray-500 line-through" : "text-white"}`}>
															{playerName}
															{hasScoutingData && (
																<span className="ml-2 text-xs text-cyan-400" title="Has scouting notes">📋</span>
															)}
														</div>
														<div className="text-xs text-gray-500">
															{playerStats && <>Rating: {playerStats.rating?.toFixed(2)} | </>}
															{ecoRatingMap[playerName.toLowerCase()] !== undefined && <>Eco: {ecoRatingMap[playerName.toLowerCase()]?.toFixed(2)}{playerStats && " | "}</>}
															{playerStats && <>ADR: {playerStats.adr?.toFixed(1)}</>}
														</div>
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
														<div className="flex flex-wrap gap-3 text-xs">
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

		</div>
	);
}
