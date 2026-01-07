import * as React from "react";
import { Loading } from "../../common/components/loading";
import { useStatsWithFallback } from "./hooks/useStatsWithFallback";
import { useCscPlayersCache } from "../../dao/cscPlayerGraphQLDao";
import { CscStats } from "../../models/csc-stats-types";
import { GMSidebar } from "./components/GMSidebar";
import { useLocalStorage } from "../../common/hooks/localStorage";
import { handleExportSettings, createImportHandler, parseColorblindColors, getPlayerTeamDisplay } from "./utils";
import { useFetchFranchisesGraph } from "../../dao/franchisesGraphQLDao";
import { Franchise } from "../../models/franchise-types";
import { useQuery } from "@tanstack/react-query";
import { PlayerTypes } from "../../common/utils/player-utils";
import { PlayerRole, AVAILABLE_STATS } from "./types";

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

// Google Sheets configuration
// https://docs.google.com/spreadsheets/d/1TL1RuDsp1Pnw971Fg4u7UOqOpMo-1e0o_S8Sg3zqHsE/edit?usp=sharing
const SPREADSHEET_ID = "1A9rmYWDTFENaTAcfY-3SdU41w9Q1uLBGXFK4G1idV3w";
const SHEET_NAME = "Sheet1";

interface DraftedPlayer {
	name: string;
	drafted: boolean;
}

// Fetch and parse Google Sheets CSV data
const fetchDraftStatus = async (): Promise<DraftedPlayer[]> => {
	const encodedSheetName = encodeURIComponent(SHEET_NAME);
	const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodedSheetName}`;
	
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch draft status from Google Sheets");
	}
	
	const csvText = await response.text();
	const lines = csvText.split("\n");
	
	// Parse CSV - first line is headers
	const players: DraftedPlayer[] = [];
	
	// Find column indices from header row
	const headerLine = lines[0];
	const headers = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
	
	const nameIndex = headers.findIndex(h => h === "name");
	const draftedIndex = headers.findIndex(h => h === "drafted?" || h === "drafted");
	
	if (nameIndex === -1) {
		console.error("Could not find 'Name' column in spreadsheet. Headers:", headers);
		return [];
	}
	
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		
		// Parse CSV line (handle quoted values)
		const values = parseCSVLine(line);
		
		if (values.length > nameIndex) {
			const name = values[nameIndex].replace(/^"|"$/g, "").trim();
			
			// Get drafted status - default to false if column not found
			let drafted = false;
			if (draftedIndex !== -1 && values.length > draftedIndex) {
				const draftedValue = values[draftedIndex].replace(/^"|"$/g, "").trim().toUpperCase();
				drafted = draftedValue === "TRUE" || draftedValue === "YES" || draftedValue === "✓" || draftedValue === "X";
			}
			
			if (name) {
				players.push({ name, drafted });
			}
		}
	}
	
	return players;
};

// Helper to parse CSV line with quoted values
const parseCSVLine = (line: string): string[] => {
	const values: string[] = [];
	let current = "";
	let inQuotes = false;
	
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === "," && !inQuotes) {
			values.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	values.push(current);
	
	return values;
};

export function DraftList() {
	const { data: franchises = [], isLoading: isLoadingFranchises } = useFetchFranchisesGraph();
	const [selectedFranchise, setSelectedFranchise] = useLocalStorage("franchise", "");
	const [selectedTier, setSelectedTier] = React.useState<string>("");
	const [searchQuery, setSearchQuery] = React.useState("");
	const [showDraftedOnly, setShowDraftedOnly] = React.useState<"all" | "available" | "drafted">("all");
	const [autoRefresh, setAutoRefresh] = React.useState(true);
	const [colorblindMode, setColorblindMode] = useLocalStorage("colorblindMode", "false");
	const [colorblindColors, setColorblindColors] = useLocalStorage("colorblindColors", JSON.stringify({ good: "#22d3ee", warning: "#fb923c", bad: "#c084fc" }));
	const [playerTargets, setPlayerTargets] = useLocalStorage("playerTargets", "{}");
	const [playerRoles, setPlayerRoles] = useLocalStorage("playerRoles", "{}");
	const [selectedStats, setSelectedStats] = useLocalStorage("selectedTargetStats", '["rating"]');
	const [sectionOrder, setSectionOrder] = useLocalStorage("dashboardSectionOrder", "[]");
	const [hiddenSections, setHiddenSections] = useLocalStorage("dashboardHiddenSections", "[]");
	const [collapsedSections, setCollapsedSections] = useLocalStorage("dashboardCollapsedSections", "[]");
	const [scoutingNotes, setScoutingNotes] = useLocalStorage("scoutingNotes", "{}");
	const [tableViewFilterPresets, setTableViewFilterPresets] = useLocalStorage("tableViewFilterPresets", "[]");
	const [myDraftList, setMyDraftList] = useLocalStorage("myDraftListByTier", "{}");
	const [statsPopupPlayer, setStatsPopupPlayer] = React.useState<string | null>(null);
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

	// Fetch draft status from Google Sheets
	const { 
		data: draftStatus = [], 
		isLoading: isLoadingDraftStatus,
		refetch: refetchDraftStatus,
		dataUpdatedAt
	} = useQuery({
		queryKey: ["draftStatus"],
		queryFn: fetchDraftStatus,
		refetchInterval: autoRefresh ? 2000 : false, // Refresh every 3 seconds if auto-refresh is on
		staleTime: 5000,
	});

	// Create a map for quick lookup of draft status
	const draftStatusMap = React.useMemo(() => {
		const map: Record<string, boolean> = {};
		draftStatus.forEach(player => {
			map[player.name.toLowerCase()] = player.drafted;
		});
		return map;
	}, [draftStatus]);

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

		// Sort by availability first (Available, Unknown, Drafted), then by rating descending
		return [...players].sort((a, b) => {
			const aStatus = draftStatusMap[a.name.toLowerCase()];
			const bStatus = draftStatusMap[b.name.toLowerCase()];
			
			// Get sort priority: Available (false) = 0, Unknown (undefined) = 1, Drafted (true) = 2
			const getPriority = (status: boolean | undefined) => {
				if (status === false) return 0; // Available
				if (status === undefined) return 1; // Unknown
				return 2; // Drafted
			};
			
			const priorityDiff = getPriority(aStatus) - getPriority(bStatus);
			if (priorityDiff !== 0) return priorityDiff;
			
			// Within same availability status, sort by rating descending
			return (b.rating || 0) - (a.rating || 0);
		});
	}, [tierPlayers, searchQuery, showDraftedOnly, draftStatusMap, playerTypeMap]);

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
	// Preserve user's manual ordering within each availability group
	const sortedDraftList = React.useMemo(() => {
		const tierList = parsedMyDraftList[selectedTier] || [];
		
		// Group players by availability status while preserving order within each group
		const available: string[] = [];
		const unknown: string[] = [];
		const drafted: string[] = [];
		
		tierList.forEach(playerName => {
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
	}, [parsedMyDraftList, selectedTier, draftStatusMap]);

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
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300">Stats</th>
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300">Action</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-700">
									{filteredPlayers.length === 0 ? (
										<tr>
											<td colSpan={5} className="px-4 py-8 text-center text-gray-400">
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
														<td colSpan={5} className="px-3 py-2">
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
														{playerStats && (
															<div className="text-xs text-gray-500">
																Rating: {playerStats.rating?.toFixed(2)} | ADR: {playerStats.adr?.toFixed(1)}
															</div>
														)}
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
