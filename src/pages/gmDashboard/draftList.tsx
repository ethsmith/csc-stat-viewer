import * as React from "react";
import { Container } from "../../common/components/container";
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

// Google Sheets configuration
const SPREADSHEET_ID = "1uDm9KChIpiFYjlA9Tr5RERplR5OzyTkn91_5jdjnFWg";
const SHEET_NAME = "Player Checklist";

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
	const [playerTargets] = useLocalStorage("playerTargets", "{}");
	const [playerRoles] = useLocalStorage("playerRoles", "{}");
	const [selectedStats] = useLocalStorage("selectedTargetStats", '["rating"]');
	const [sectionOrder] = useLocalStorage("dashboardSectionOrder", "[]");
	const [hiddenSections] = useLocalStorage("dashboardHiddenSections", "[]");
	const [collapsedSections] = useLocalStorage("dashboardCollapsedSections", "[]");
	const [scoutingNotes] = useLocalStorage("scoutingNotes", "{}");
	const [myDraftList, setMyDraftList] = useLocalStorage("myDraftListByTier", "{}");
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	// Drag and drop state for personal draft list - now includes tier
	const [draggedItem, setDraggedItem] = React.useState<{ tier: string; index: number } | null>(null);
	const [dragOverItem, setDragOverItem] = React.useState<{ tier: string; index: number } | null>(null);

	// Parse my draft list from localStorage - now keyed by tier
	const parsedMyDraftList: Record<string, string[]> = React.useMemo(() => {
		try {
			return JSON.parse(myDraftList);
		} catch {
			return {};
		}
	}, [myDraftList]);

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

	// Drag and drop handlers - now tier-aware
	const handleDragStart = (tier: string, index: number) => {
		setDraggedItem({ tier, index });
	};

	const handleDragOver = (e: React.DragEvent, tier: string, index: number) => {
		e.preventDefault();
		setDragOverItem({ tier, index });
	};

	const handleDragEnd = () => {
		setDraggedItem(null);
		setDragOverItem(null);
	};

	const handleDrop = (e: React.DragEvent, dropTier: string, dropIndex: number) => {
		e.preventDefault();
		if (!draggedItem || (draggedItem.tier === dropTier && draggedItem.index === dropIndex)) {
			handleDragEnd();
			return;
		}

		// Only allow reordering within the same tier
		if (draggedItem.tier !== dropTier) {
			handleDragEnd();
			return;
		}

		const tierList = [...(parsedMyDraftList[dropTier] || [])];
		const [draggedPlayer] = tierList.splice(draggedItem.index, 1);
		tierList.splice(dropIndex, 0, draggedPlayer);
		
		const newList = { ...parsedMyDraftList, [dropTier]: tierList };
		setMyDraftList(JSON.stringify(newList));
		handleDragEnd();
	};

	// Move player up in the list within a tier
	const movePlayerUp = (tier: string, index: number) => {
		if (index === 0) return;
		const tierList = [...(parsedMyDraftList[tier] || [])];
		[tierList[index - 1], tierList[index]] = [tierList[index], tierList[index - 1]];
		const newList = { ...parsedMyDraftList, [tier]: tierList };
		setMyDraftList(JSON.stringify(newList));
	};

	// Move player down in the list within a tier
	const movePlayerDown = (tier: string, index: number) => {
		const tierList = parsedMyDraftList[tier] || [];
		if (index === tierList.length - 1) return;
		const newTierList = [...tierList];
		[newTierList[index], newTierList[index + 1]] = [newTierList[index + 1], newTierList[index]];
		const newList = { ...parsedMyDraftList, [tier]: newTierList };
		setMyDraftList(JSON.stringify(newList));
	};

	// Clear all players from a specific tier
	const clearTierDraftList = (tier: string) => {
		const newList = { ...parsedMyDraftList, [tier]: [] };
		setMyDraftList(JSON.stringify(newList));
	};

	// Clear all draft lists
	const clearAllDraftLists = () => {
		setMyDraftList("{}");
	};

	// Get total count of players across all tiers
	const totalDraftListCount = React.useMemo(() => {
		return Object.values(parsedMyDraftList).reduce((sum, tierList) => sum + tierList.length, 0);
	}, [parsedMyDraftList]);

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
		refetchInterval: autoRefresh ? 10000 : false, // Refresh every 10 seconds if auto-refresh is on
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

		// Sort by rating descending
		return [...players].sort((a, b) => (b.rating || 0) - (a.rating || 0));
	}, [tierPlayers, searchQuery, showDraftedOnly, draftStatusMap]);

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

	const isLoading = isLoadingFranchises || isLoadingStats;

	if (isLoading) {
		return <Loading />;
	}

	const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "Never";

	const handleExport = () => {
		handleExportSettings(
			selectedFranchise,
			colorblindMode,
			colorblindColors,
			playerTargets,
			playerRoles,
			selectedStats,
			sectionOrder,
			hiddenSections,
			collapsedSections,
			scoutingNotes
		);
	};

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleImportSettings = createImportHandler(
		() => {},
		() => {},
		() => {},
		() => {},
		() => {},
		() => {},
		() => {},
		() => {},
		() => {},
		() => {}
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
										<th className="px-3 py-2 text-center text-xs font-semibold text-gray-300">Action</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-700">
									{filteredPlayers.length === 0 ? (
										<tr>
											<td colSpan={4} className="px-4 py-8 text-center text-gray-400">
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
												<tr 
													key={player.name} 
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
							{(parsedMyDraftList[selectedTier] || []).length === 0 ? (
								<div className="px-4 py-8 text-center text-gray-400">
									<p>No players in your {selectedTier} draft list</p>
									<p className="text-sm mt-2">Add players from the tier list on the left</p>
								</div>
							) : (
								<div className="divide-y divide-gray-700">
									{(parsedMyDraftList[selectedTier] || []).map((playerName, index) => {
										const playerStats = tierPlayers.find(p => p.name === playerName);
										const isDrafted = draftStatusMap[playerName.toLowerCase()];
										const statusKnown = isDrafted !== undefined;
										
										return (
											<div
												key={playerName}
												draggable
												onDragStart={() => handleDragStart(selectedTier, index)}
												onDragOver={(e) => handleDragOver(e, selectedTier, index)}
												onDragEnd={handleDragEnd}
												onDrop={(e) => handleDrop(e, selectedTier, index)}
												className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-750 transition-all cursor-grab active:cursor-grabbing ${
													draggedItem?.tier === selectedTier && draggedItem?.index === index ? "opacity-50" : ""
												} ${dragOverItem?.tier === selectedTier && dragOverItem?.index === index ? "ring-2 ring-blue-500 ring-inset" : ""} ${
													isDrafted ? "bg-red-900/20" : ""
												}`}
											>
												{/* Rank/Order */}
												<div className="flex flex-col items-center gap-1">
													<button
														onClick={() => movePlayerUp(selectedTier, index)}
														disabled={index === 0}
														className="p-0.5 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
													>
														<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
															<path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
														</svg>
													</button>
													<span className="text-lg font-bold text-gray-500 w-6 text-center">{index + 1}</span>
													<button
														onClick={() => movePlayerDown(selectedTier, index)}
														disabled={index === (parsedMyDraftList[selectedTier] || []).length - 1}
														className="p-0.5 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
													>
														<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
															<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
														</svg>
													</button>
												</div>

												{/* Player Info */}
												<div className="flex-1 min-w-0">
													<div className={`font-medium ${isDrafted ? "text-gray-500 line-through" : "text-white"}`}>
														{playerName}
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
