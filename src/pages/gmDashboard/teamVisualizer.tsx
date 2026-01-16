import * as React from "react";
import { Container } from "../../common/components/container";
import { Loading } from "../../common/components/loading";
import { useFetchFranchisesGraph } from "../../dao/franchisesGraphQLDao";
import { Franchise } from "../../models/franchise-types";
import { useStatsWithFallback } from "./hooks/useStatsWithFallback";
import { useGMSettings } from "./hooks/useGMSettings";
import { CscStats } from "../../models/csc-stats-types";
import { GMSidebar } from "./components/GMSidebar";
import { OffSeasonBanner } from "./components/OffSeasonBanner";
import { handleExportSettings, createImportHandler, parseColorblindColors, getPlayerTeamDisplay } from "./utils";
import { useCscPlayersCache } from "../../dao/cscPlayerGraphQLDao";
import { useLocalStorage } from "../../common/hooks/localStorage";
import { useEcoRatings, MapName } from "./hooks/useEcoRatings";
import { useExtendedStats, ExtendedPlayerStats, EXTENDED_STATS_COLUMNS } from "./hooks/useExtendedStats";

type FilterPreset = {
	name: string;
	teamFilter: string;
	minGames: number;
	statFilters: Array<{ stat: string; operator: "<" | ">" | "<=" | ">=" | "="; value: number }>;
	sortColumn: string;
	sortDirection: "asc" | "desc";
	statsSource?: "csc" | "extended";
};

type SavedLineup = {
	id: string;
	name: string;
	tier: string;
	players: string[];
	createdAt: number;
};

// Unified player type that can hold either CSC or Extended stats
type UnifiedPlayer = {
	name: string;
	rating: number;
	games: number;
	source: "csc" | "extended";
	cscStats?: CscStats;
	extendedStats?: ExtendedPlayerStats;
	teamDisplay?: string;
};

export function TeamVisualizer() {
	const { data: franchises = [], isLoading } = useFetchFranchisesGraph();
	
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
		tableViewFilterPresets: savedFilterPresets, setTableViewFilterPresets: setSavedFilterPresets,
		myDraftList, setMyDraftList,
	} = useGMSettings();

	const [savedLineups, setSavedLineups] = useLocalStorage("teamVisualizerLineups", "[]");
	const [selectedTier, setSelectedTier] = React.useState<string>("");
	const [currentLineup, setCurrentLineup] = React.useState<string[]>([]);
	const [lineupName, setLineupName] = React.useState("");
	const [showSaveModal, setShowSaveModal] = React.useState(false);
	const [selectedPresetFilter, setSelectedPresetFilter] = React.useState<string>("");
	const [selectedPresetSource, setSelectedPresetSource] = React.useState<"all" | "csc" | "extended">("all");
	const [playerSearchQuery, setPlayerSearchQuery] = React.useState("");
	const [hoveredPlayer, setHoveredPlayer] = React.useState<string | null>(null);
	const [hoverPosition, setHoverPosition] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const { 
		statsCache, 
		isLoading: isLoadingStats,
		isUsingFallback,
		effectiveSeason 
	} = useStatsWithFallback();

	const { data: playersData } = useCscPlayersCache(effectiveSeason);
	const { ecoRatingMap, ecoDataMap } = useEcoRatings();
	
	// Fetch extended stats
	const { 
		statsByTier: extendedStatsByTier, 
		availableTiers: extendedAvailableTiers,
		isLoading: isLoadingExtendedStats 
	} = useExtendedStats();

	const currentFranchise = franchises.find((f: Franchise) => f.prefix === selectedFranchise);

	// Use CSC tiers as primary (they should match)
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

	// CSC tier players
	const cscTierPlayers: CscStats[] = React.useMemo(() => {
		if (!statsCache?.data || !selectedTier) return [];
		return statsCache.data[selectedTier as keyof typeof statsCache.data] || [];
	}, [statsCache, selectedTier]);

	// Extended tier players
	const extendedTierPlayers: ExtendedPlayerStats[] = React.useMemo(() => {
		if (!selectedTier) return [];
		return extendedStatsByTier[selectedTier] || [];
	}, [extendedStatsByTier, selectedTier]);

	const parsedPresets: FilterPreset[] = React.useMemo(() => {
		try {
			return JSON.parse(savedFilterPresets);
		} catch {
			return [];
		}
	}, [savedFilterPresets]);

	const cscPresets = React.useMemo(() => {
		return parsedPresets.filter(p => !p.statsSource || p.statsSource === "csc");
	}, [parsedPresets]);

	const extendedPresets = React.useMemo(() => {
		return parsedPresets.filter(p => p.statsSource === "extended");
	}, [parsedPresets]);

	// All presets combined
	const allPresets = parsedPresets;

	// Create unified player list combining CSC and Extended stats
	const unifiedPlayers: UnifiedPlayer[] = React.useMemo(() => {
		const playerMap = new Map<string, UnifiedPlayer>();
		
		// Add CSC players first
		cscTierPlayers.forEach(player => {
			const teamDisplay = getPlayerTeamDisplay(player.name, player.team, playersData);
			playerMap.set(player.name.toLowerCase(), {
				name: player.name,
				rating: player.rating || 0,
				games: player.gameCount || 0,
				source: "csc",
				cscStats: player,
				teamDisplay,
			});
		});
		
		// Add/merge Extended stats
		extendedTierPlayers.forEach(player => {
			const key = player.name.toLowerCase();
			const existing = playerMap.get(key);
			if (existing) {
				// Player exists in CSC, add extended stats
				existing.extendedStats = player;
			} else {
				// Player only in extended stats
				const teamDisplay = getPlayerTeamDisplay(player.name, undefined, playersData);
				playerMap.set(key, {
					name: player.name,
					rating: player.final_rating || 0,
					games: player.games_count || 0,
					source: "extended",
					extendedStats: player,
					teamDisplay,
				});
			}
		});
		
		return Array.from(playerMap.values());
	}, [cscTierPlayers, extendedTierPlayers, playersData]);

	const parsedLineups: SavedLineup[] = React.useMemo(() => {
		try {
			return JSON.parse(savedLineups);
		} catch {
			return [];
		}
	}, [savedLineups]);

	// Check if CSC player matches a CSC preset
	const checkCscPlayerMatchesPreset = React.useCallback((player: CscStats, preset: FilterPreset): boolean => {
		if (preset.minGames > 0 && (player.gameCount || 0) < preset.minGames) {
			return false;
		}

		for (const filter of preset.statFilters) {
			let val: number | undefined;
			if (filter.stat === "ecoRating") {
				val = ecoRatingMap[player.name.toLowerCase()];
			} else if (filter.stat.startsWith("mapRating_")) {
				const mapName = filter.stat.replace("mapRating_", "") as MapName;
				val = ecoDataMap[player.name.toLowerCase()]?.mapData?.[mapName]?.rating;
			} else if (filter.stat.startsWith("mapGames_")) {
				const mapName = filter.stat.replace("mapGames_", "") as MapName;
				val = ecoDataMap[player.name.toLowerCase()]?.mapData?.[mapName]?.gamesPlayed;
			} else {
				val = player[filter.stat as keyof CscStats] as number | undefined;
			}
			
			if (val === undefined) return false;
			
			let passes = false;
			switch (filter.operator) {
				case "<": passes = val < filter.value; break;
				case ">": passes = val > filter.value; break;
				case "<=": passes = val <= filter.value; break;
				case ">=": passes = val >= filter.value; break;
				case "=": passes = val === filter.value; break;
			}
			if (!passes) return false;
		}
		return true;
	}, [ecoRatingMap, ecoDataMap]);

	// Check if extended stats player matches an extended preset
	const checkExtendedPlayerMatchesPreset = React.useCallback((player: ExtendedPlayerStats, preset: FilterPreset): boolean => {
		if (preset.minGames > 0 && (player.games_count || 0) < preset.minGames) {
			return false;
		}

		for (const filter of preset.statFilters) {
			let val: number | undefined;
			if (filter.stat.startsWith("mapRating_")) {
				const mapName = filter.stat.replace("mapRating_", "") as MapName;
				val = player.map_ratings[mapName];
			} else if (filter.stat.startsWith("mapGames_")) {
				const mapName = filter.stat.replace("mapGames_", "") as MapName;
				val = player.map_games_played[mapName];
			} else {
				val = player[filter.stat as keyof ExtendedPlayerStats] as number | undefined;
			}
			
			if (val === undefined) return false;
			
			let passes = false;
			switch (filter.operator) {
				case "<": passes = val < filter.value; break;
				case ">": passes = val > filter.value; break;
				case "<=": passes = val <= filter.value; break;
				case ">=": passes = val >= filter.value; break;
				case "=": passes = val === filter.value; break;
			}
			if (!passes) return false;
		}
		return true;
	}, []);

	// Get all matching presets for a unified player
	const getMatchingPresets = React.useCallback((player: UnifiedPlayer): FilterPreset[] => {
		const matching: FilterPreset[] = [];
		
		// Check CSC presets if player has CSC stats
		if (player.cscStats) {
			cscPresets.forEach(preset => {
				if (checkCscPlayerMatchesPreset(player.cscStats!, preset)) {
					matching.push(preset);
				}
			});
		}
		
		// Check extended presets if player has extended stats
		if (player.extendedStats) {
			extendedPresets.forEach(preset => {
				if (checkExtendedPlayerMatchesPreset(player.extendedStats!, preset)) {
					matching.push(preset);
				}
			});
		}
		
		return matching;
	}, [cscPresets, extendedPresets, checkCscPlayerMatchesPreset, checkExtendedPlayerMatchesPreset]);

	// Filtered unified players
	const filteredPlayers = React.useMemo(() => {
		let players = unifiedPlayers;

		// Apply preset filter
		if (selectedPresetFilter) {
			const cscPreset = cscPresets.find(p => p.name === selectedPresetFilter);
			const extPreset = extendedPresets.find(p => p.name === selectedPresetFilter);
			
			players = players.filter(p => {
				// Check if matches CSC preset
				if (cscPreset && p.cscStats && checkCscPlayerMatchesPreset(p.cscStats, cscPreset)) {
					return true;
				}
				// Check if matches extended preset
				if (extPreset && p.extendedStats && checkExtendedPlayerMatchesPreset(p.extendedStats, extPreset)) {
					return true;
				}
				return false;
			});
		}

		// Apply search filter
		if (playerSearchQuery) {
			const query = playerSearchQuery.toLowerCase();
			players = players.filter(p => p.name.toLowerCase().includes(query));
		}

		// Sort by rating
		return players.sort((a, b) => b.rating - a.rating);
	}, [unifiedPlayers, selectedPresetFilter, playerSearchQuery, cscPresets, extendedPresets, checkCscPlayerMatchesPreset, checkExtendedPlayerMatchesPreset]);

	const addPlayerToLineup = (playerName: string) => {
		if (currentLineup.length >= 5) return;
		if (currentLineup.includes(playerName)) return;
		setCurrentLineup([...currentLineup, playerName]);
	};

	const removePlayerFromLineup = (playerName: string) => {
		setCurrentLineup(currentLineup.filter(n => n !== playerName));
	};

	const clearLineup = () => {
		setCurrentLineup([]);
	};

	const saveLineup = () => {
		if (!lineupName.trim() || currentLineup.length === 0) return;
		
		const newLineup: SavedLineup = {
			id: Date.now().toString(),
			name: lineupName.trim(),
			tier: selectedTier,
			players: currentLineup,
			createdAt: Date.now(),
		};

		const existingIndex = parsedLineups.findIndex(l => l.name === newLineup.name && l.tier === newLineup.tier);
		let updatedLineups: SavedLineup[];
		if (existingIndex >= 0) {
			updatedLineups = [...parsedLineups];
			updatedLineups[existingIndex] = newLineup;
		} else {
			updatedLineups = [...parsedLineups, newLineup];
		}
		
		setSavedLineups(JSON.stringify(updatedLineups));
		setLineupName("");
		setShowSaveModal(false);
	};

	const loadLineup = (lineup: SavedLineup) => {
		setSelectedTier(lineup.tier);
		setCurrentLineup(lineup.players);
	};

	const deleteLineup = (lineupId: string) => {
		const updatedLineups = parsedLineups.filter(l => l.id !== lineupId);
		setSavedLineups(JSON.stringify(updatedLineups));
	};

	const getUnifiedPlayer = (playerName: string): UnifiedPlayer | undefined => {
		return unifiedPlayers.find(p => p.name === playerName);
	};

	const handlePlayerClick = (playerName: string, event: React.MouseEvent) => {
		// Toggle: if clicking the same player, close the tooltip; otherwise show new player
		if (hoveredPlayer === playerName) {
			setHoveredPlayer(null);
		} else {
			setHoveredPlayer(playerName);
			setHoverPosition({ x: event.clientX, y: event.clientY });
		}
	};

	
	const handleExport = () => {
		handleExportSettings(selectedFranchise, playerTargets, playerRoles, selectedStats, sectionOrder, hiddenSections, collapsedSections, scoutingNotes, colorblindMode, colorblindColors, savedFilterPresets, myDraftList);
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
		setSavedFilterPresets,
		setMyDraftList
	);

	const lineupStats = React.useMemo(() => {
		if (currentLineup.length === 0) return null;
		
		const players = currentLineup.map(name => getUnifiedPlayer(name)).filter(Boolean) as UnifiedPlayer[];
		if (players.length === 0) return null;

		// Calculate averages using CSC stats when available, falling back to extended
		let totalRating = 0, totalAdr = 0, totalKast = 0, totalImpact = 0;
		
		players.forEach(p => {
			if (p.cscStats) {
				totalRating += p.cscStats.rating || 0;
				totalAdr += p.cscStats.adr || 0;
				totalKast += p.cscStats.kast || 0;
				totalImpact += p.cscStats.impact || 0;
			} else if (p.extendedStats) {
				totalRating += p.extendedStats.final_rating || 0;
				totalAdr += p.extendedStats.adr || 0;
				totalKast += (p.extendedStats.kast || 0) * 100; // Extended KAST is 0-1
				totalImpact += p.extendedStats.round_impact || 0;
			}
		});

		return {
			avgRating: totalRating / players.length,
			avgAdr: totalAdr / players.length,
			avgKast: totalKast / players.length,
			avgImpact: totalImpact / players.length,
			playerCount: players.length
		};
	}, [currentLineup, unifiedPlayers]);

	const tierLineups = React.useMemo(() => {
		return parsedLineups.filter(l => l.tier === selectedTier);
	}, [parsedLineups, selectedTier]);

	if (isLoading || isLoadingStats || isLoadingExtendedStats) {
		return (
			<Container>
				<Loading />
			</Container>
		);
	}

	return (
		<div className="flex min-h-screen bg-gray-900">
			<GMSidebar
				currentFranchise={currentFranchise}
				currentPage="teamvisualizer"
				onExport={handleExport}
				onImport={() => fileInputRef.current?.click()}
				onChangeFranchise={() => setSelectedFranchise("")}
				fileInputRef={fileInputRef}
				onFileChange={handleImportSettings}
				colorblindMode={colorblindMode === "true"}
				onToggleColorblindMode={() => setColorblindMode(colorblindMode === "true" ? "false" : "true")}
				colorblindColors={parseColorblindColors(colorblindColors)}
				onColorblindColorsChange={(colors) => setColorblindColors(JSON.stringify(colors))}
			/>

			<div className="flex-1 p-6 overflow-auto">
				{isUsingFallback && <OffSeasonBanner effectiveSeason={effectiveSeason} />}

				<div className="mb-6">
					<h1 className="text-2xl font-bold text-white mb-2">Team Visualizer</h1>
					<p className="text-gray-400 text-sm">Create and save 5-man lineups for any tier. Players show both CSC and Extended stats when available.</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Left Panel - Player Selection */}
					<div className="lg:col-span-2 space-y-4">
						{/* Controls */}
						<div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
							<div className="flex flex-wrap gap-4 items-end">
								<div>
									<label className="block text-sm text-gray-400 mb-1">Select Tier</label>
									<select
										value={selectedTier}
										onChange={(e) => {
											setSelectedTier(e.target.value);
											setCurrentLineup([]);
										}}
										className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
									>
										{availableTiers.map(tier => (
											<option key={tier} value={tier}>{tier}</option>
										))}
									</select>
								</div>

								<div>
									<label className="block text-sm text-gray-400 mb-1">Filter by Preset</label>
									<select
										value={selectedPresetFilter}
										onChange={(e) => setSelectedPresetFilter(e.target.value)}
										className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 min-w-[200px]"
									>
										<option value="">All Players</option>
										{cscPresets.length > 0 && (
											<optgroup label="CSC Presets">
												{cscPresets.map(preset => (
													<option key={`csc-${preset.name}`} value={preset.name}>{preset.name}</option>
												))}
											</optgroup>
										)}
										{extendedPresets.length > 0 && (
											<optgroup label="Extended Stats Presets">
												{extendedPresets.map(preset => (
													<option key={`ext-${preset.name}`} value={preset.name}>{preset.name}</option>
												))}
											</optgroup>
										)}
									</select>
								</div>

								<div className="flex-1">
									<label className="block text-sm text-gray-400 mb-1">Search Players</label>
									<input
										type="text"
										placeholder="Search by name..."
										value={playerSearchQuery}
										onChange={(e) => setPlayerSearchQuery(e.target.value)}
										className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
									/>
								</div>
							</div>
						</div>

						{/* Player List */}
						<div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
							<div className="p-3 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
								<h3 className="text-sm font-medium text-white">
									Available Players ({filteredPlayers.length})
								</h3>
								{selectedPresetFilter && (
									<span className="text-xs text-blue-400">
										Filtered by: {selectedPresetFilter}
									</span>
								)}
							</div>
							<div className="max-h-[400px] overflow-y-auto">
								{filteredPlayers.length === 0 ? (
									<div className="p-4 text-center text-gray-500">
										No players match the current filters
									</div>
								) : (
									<div className="divide-y divide-gray-700">
										{filteredPlayers.map(player => {
											const isInLineup = currentLineup.includes(player.name);
											const matchingPresets = getMatchingPresets(player);
											const hasBothStats = player.cscStats && player.extendedStats;
											
											return (
												<div
													key={player.name}
													className={`p-3 flex items-center justify-between hover:bg-gray-750 transition-colors ${
														isInLineup ? "bg-blue-900/20" : ""
													}`}
													onClick={(e) => handlePlayerClick(player.name, e)}
																																						>
													<div className="flex-1">
														<div className="flex items-center gap-2">
															<span className="text-white font-medium">{player.name}</span>
															{player.teamDisplay && (
																<span className="text-xs text-gray-500">{player.teamDisplay}</span>
															)}
															{/* Stats source indicators */}
															<div className="flex gap-1">
																{player.cscStats && (
																	<span className="px-1 py-0.5 text-[10px] bg-blue-900/50 text-blue-400 rounded">CSC</span>
																)}
																{player.extendedStats && (
																	<span className="px-1 py-0.5 text-[10px] bg-purple-900/50 text-purple-400 rounded">EXT</span>
																)}
															</div>
														</div>
														<div className="flex items-center gap-2 mt-1">
															<span className="text-xs text-yellow-400">
																Rating: {player.rating?.toFixed(2) || "N/A"}
															</span>
															<span className="text-xs text-gray-500">
																{player.games} games
															</span>
															{matchingPresets.length > 0 && (
																<div className="flex gap-1">
																	{matchingPresets.slice(0, 3).map(preset => (
																		<span
																			key={preset.name}
																			className={`px-1.5 py-0.5 text-xs rounded ${
																				preset.statsSource === "extended" 
																					? "bg-purple-900/50 text-purple-400"
																					: "bg-green-900/50 text-green-400"
																			}`}
																		>
																			{preset.name}
																		</span>
																	))}
																	{matchingPresets.length > 3 && (
																		<span className="text-xs text-gray-500">
																			+{matchingPresets.length - 3} more
																		</span>
																	)}
																</div>
															)}
														</div>
													</div>
													<button
														onClick={() => isInLineup ? removePlayerFromLineup(player.name) : addPlayerToLineup(player.name)}
														disabled={!isInLineup && currentLineup.length >= 5}
														className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
															isInLineup
																? "bg-red-600 hover:bg-red-500 text-white"
																: currentLineup.length >= 5
																	? "bg-gray-600 text-gray-400 cursor-not-allowed"
																	: "bg-blue-600 hover:bg-blue-500 text-white"
														}`}
													>
														{isInLineup ? "Remove" : "Add"}
													</button>
												</div>
											);
										})}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Right Panel - Current Lineup & Saved Lineups */}
					<div className="space-y-4">
						{/* Current Lineup */}
						<div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
							<div className="p-3 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
								<h3 className="text-sm font-medium text-white">
									Current Lineup ({currentLineup.length}/5)
								</h3>
								<div className="flex gap-2">
									{currentLineup.length > 0 && (
										<>
											<button
												onClick={clearLineup}
												className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
											>
												Clear
											</button>
											<button
												onClick={() => setShowSaveModal(true)}
												className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
											>
												Save
											</button>
										</>
									)}
								</div>
							</div>
							
							<div className="p-4">
								{currentLineup.length === 0 ? (
									<div className="text-center text-gray-500 py-8">
										<p className="text-sm">No players selected</p>
										<p className="text-xs mt-1">Add players from the list to build your lineup</p>
									</div>
								) : (
									<div className="space-y-2">
										{currentLineup.map((playerName, index) => {
											const player = getUnifiedPlayer(playerName);
											const rating = player?.rating?.toFixed(2);
											return (
												<div
													key={playerName}
													className="flex items-center justify-between p-2 rounded-lg bg-gray-700"
													onClick={(e) => handlePlayerClick(playerName, e)}
																																						>
													<div className="flex items-center gap-2">
														<span className="w-6 h-6 flex items-center justify-center text-white text-xs font-bold rounded-full bg-blue-600">
															{index + 1}
														</span>
														<span className="text-white font-medium">{playerName}</span>
														{/* Stats source indicators */}
														<div className="flex gap-1">
															{player?.cscStats && (
																<span className="px-1 py-0.5 text-[10px] bg-blue-900/50 text-blue-400 rounded">CSC</span>
															)}
															{player?.extendedStats && (
																<span className="px-1 py-0.5 text-[10px] bg-purple-900/50 text-purple-400 rounded">EXT</span>
															)}
														</div>
													</div>
													<div className="flex items-center gap-2">
														<span className="text-xs text-yellow-400">
															{rating || "N/A"}
														</span>
														<button
															onClick={() => removePlayerFromLineup(playerName)}
															className="text-red-400 hover:text-red-300 transition-colors"
														>
															<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
																<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
															</svg>
														</button>
													</div>
												</div>
											);
										})}
									</div>
								)}

								{/* Lineup Stats Summary */}
								{lineupStats && (
									<div className="mt-4 pt-4 border-t border-gray-700">
										<h4 className="text-xs font-medium text-gray-400 mb-2">Team Averages</h4>
										<div className="grid grid-cols-2 gap-2 text-sm">
											<div className="flex justify-between">
												<span className="text-gray-400">Rating:</span>
												<span className="text-yellow-400 font-medium">{lineupStats.avgRating.toFixed(2)}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-400">ADR:</span>
												<span className="text-white">{lineupStats.avgAdr.toFixed(1)}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-400">KAST:</span>
												<span className="text-white">{lineupStats.avgKast.toFixed(1)}%</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-400">Impact:</span>
												<span className="text-white">{lineupStats.avgImpact.toFixed(2)}</span>
											</div>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Saved Lineups */}
						<div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
							<div className="p-3 bg-gray-900 border-b border-gray-700">
								<h3 className="text-sm font-medium text-white">
									Saved Lineups - {selectedTier}
								</h3>
							</div>
							<div className="max-h-[300px] overflow-y-auto">
								{tierLineups.length === 0 ? (
									<div className="p-4 text-center text-gray-500 text-sm">
										No saved lineups for this tier
									</div>
								) : (
									<div className="divide-y divide-gray-700">
										{tierLineups.map(lineup => (
											<div
												key={lineup.id}
												className="p-3 hover:bg-gray-750 transition-colors"
											>
												<div className="flex items-center justify-between mb-2">
													<span className="text-white font-medium">{lineup.name}</span>
													<div className="flex gap-1">
														<button
															onClick={() => loadLineup(lineup)}
															className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
														>
															Load
														</button>
														<button
															onClick={() => deleteLineup(lineup.id)}
															className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
														>
															Delete
														</button>
													</div>
												</div>
												<div className="flex flex-wrap gap-1">
													{lineup.players.map(name => (
														<span
															key={name}
															className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded"
														>
															{name}
														</span>
													))}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</div>

						{/* All Saved Lineups (other tiers) */}
						{parsedLineups.filter(l => l.tier !== selectedTier).length > 0 && (
							<div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
								<div className="p-3 bg-gray-900 border-b border-gray-700">
									<h3 className="text-sm font-medium text-white">
										Other Tier Lineups
									</h3>
								</div>
								<div className="max-h-[200px] overflow-y-auto">
									<div className="divide-y divide-gray-700">
										{parsedLineups.filter(l => l.tier !== selectedTier).map(lineup => (
											<div
												key={lineup.id}
												className="p-3 hover:bg-gray-750 transition-colors"
											>
												<div className="flex items-center justify-between mb-1">
													<div className="flex items-center gap-2">
														<span className="text-white font-medium">{lineup.name}</span>
														<span className="px-1.5 py-0.5 text-xs bg-purple-900/50 text-purple-400 rounded">
															{lineup.tier}
														</span>
													</div>
													<div className="flex gap-1">
														<button
															onClick={() => loadLineup(lineup)}
															className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
														>
															Load
														</button>
														<button
															onClick={() => deleteLineup(lineup.id)}
															className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
														>
															Delete
														</button>
													</div>
												</div>
												<div className="text-xs text-gray-500">
													{lineup.players.join(", ")}
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Save Lineup Modal */}
				{showSaveModal && (
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
						<div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-700">
							<h3 className="text-lg font-bold text-white mb-4">Save Lineup</h3>
							<input
								type="text"
								placeholder="Enter lineup name..."
								value={lineupName}
								onChange={(e) => setLineupName(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && saveLineup()}
								className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
								autoFocus
							/>
							<div className="text-sm text-gray-400 mb-4">
								<p className="mb-2">Tier: <span className="text-white">{selectedTier}</span></p>
								<p className="mb-1">Players:</p>
								<div className="flex flex-wrap gap-1">
									{currentLineup.map(name => (
										<span key={name} className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
											{name}
										</span>
									))}
								</div>
							</div>
							<div className="flex gap-2 justify-end">
								<button
									onClick={() => {
										setShowSaveModal(false);
										setLineupName("");
									}}
									className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={saveLineup}
									disabled={!lineupName.trim()}
									className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
								>
									Save
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Player Tooltip - Click to show, click another player or close button to hide */}
				{hoveredPlayer && getUnifiedPlayer(hoveredPlayer) && (
					<UnifiedPlayerHoverTooltip
						player={getUnifiedPlayer(hoveredPlayer)!}
						matchingPresets={getMatchingPresets(getUnifiedPlayer(hoveredPlayer)!)}
						position={hoverPosition}
						onClose={() => setHoveredPlayer(null)}
					/>
				)}
			</div>
		</div>
	);
}

interface UnifiedPlayerHoverTooltipProps {
	player: UnifiedPlayer;
	matchingPresets: FilterPreset[];
	position: { x: number; y: number };
	onClose: () => void;
}

function UnifiedPlayerHoverTooltip({ player, matchingPresets, position, onClose }: UnifiedPlayerHoverTooltipProps) {
	const tooltipStyle: React.CSSProperties = {
		position: "fixed",
		left: Math.min(position.x + 15, window.innerWidth - 400),
		top: Math.min(position.y + 15, window.innerHeight - 500),
		zIndex: 100,
	};

	const csc = player.cscStats;
	const ext = player.extendedStats;

	return (
		<div
			style={tooltipStyle}
			className="w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4"
		>
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<h4 className="text-white font-bold">{player.name}</h4>
					<div className="flex gap-1">
						{csc && <span className="px-1 py-0.5 text-[10px] bg-blue-900/50 text-blue-400 rounded">CSC</span>}
						{ext && <span className="px-1 py-0.5 text-[10px] bg-purple-900/50 text-purple-400 rounded">EXT</span>}
					</div>
				</div>
				<button
					onClick={onClose}
					className="text-gray-400 hover:text-white transition-colors ml-2"
					title="Close"
				>
					<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
						<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
					</svg>
				</button>
			</div>
			<div className="flex items-center justify-between mb-3">
				<div></div>
				<span className="px-2 py-1 bg-yellow-900/50 text-yellow-400 text-sm font-bold rounded">
					{player.rating?.toFixed(2)} Rating
				</span>
			</div>

			{/* CSC Stats */}
			{csc && (
				<div className="mb-3">
					<h5 className="text-xs font-medium text-blue-400 mb-2">CSC Stats</h5>
					<div className="grid grid-cols-4 gap-2 text-xs">
						<div className="flex justify-between">
							<span className="text-gray-400">ADR:</span>
							<span className="text-white">{csc.adr?.toFixed(1) || "N/A"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">KAST:</span>
							<span className="text-white">{csc.kast?.toFixed(1) || "N/A"}%</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">K/R:</span>
							<span className="text-white">{csc.kr?.toFixed(2) || "N/A"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">Impact:</span>
							<span className="text-white">{csc.impact?.toFixed(2) || "N/A"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">HS%:</span>
							<span className="text-white">{csc.hs?.toFixed(1) || "N/A"}%</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">Games:</span>
							<span className="text-white">{csc.gameCount || "N/A"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">OD%:</span>
							<span className="text-white">{csc.odr?.toFixed(1) || "N/A"}%</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">Clutch:</span>
							<span className="text-white">{csc.clutchR?.toFixed(2) || "N/A"}</span>
						</div>
					</div>
				</div>
			)}

			{/* Extended Stats */}
			{ext && (
				<div className={csc ? "border-t border-gray-700 pt-2 mb-3" : "mb-3"}>
					<h5 className="text-xs font-medium text-purple-400 mb-2">Extended Stats</h5>
					<div className="grid grid-cols-4 gap-2 text-xs">
						<div className="flex justify-between">
							<span className="text-gray-400">Rating:</span>
							<span className="text-white">{ext.final_rating?.toFixed(2) || "N/A"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">ADR:</span>
							<span className="text-white">{ext.adr?.toFixed(1) || "N/A"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">KPR:</span>
							<span className="text-white">{ext.kpr?.toFixed(2) || "N/A"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">DPR:</span>
							<span className="text-white">{ext.dpr?.toFixed(2) || "N/A"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">OK/R:</span>
							<span className="text-white">{ext.opening_kills_per_round?.toFixed(2) || "N/A"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">Clutch:</span>
							<span className="text-white">{ext.clutch_wins || 0}/{ext.clutch_rounds || 0}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">Impact:</span>
							<span className="text-white">{ext.round_impact?.toFixed(2) || "N/A"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-400">Games:</span>
							<span className="text-white">{ext.games_count || "N/A"}</span>
						</div>
					</div>
				</div>
			)}

			{/* Matching Presets */}
			{matchingPresets.length > 0 && (
				<div className="border-t border-gray-700 pt-3">
					<h5 className="text-xs font-medium text-gray-400 mb-2">Matches Filter Presets:</h5>
					<div 
						className="space-y-2 max-h-32 overflow-y-auto overscroll-contain"
						onWheel={(e) => e.stopPropagation()}
					>
						{matchingPresets.map(preset => (
							<div key={preset.name} className="bg-gray-800 rounded p-2">
								<div className={`text-sm font-medium mb-1 ${preset.statsSource === "extended" ? "text-purple-400" : "text-green-400"}`}>
									{preset.name}
									<span className="ml-1 text-[10px] text-gray-500">({preset.statsSource === "extended" ? "EXT" : "CSC"})</span>
								</div>
								{preset.statFilters.length > 0 && (
									<div className="text-xs text-gray-500">
										{preset.statFilters.slice(0, 3).map((f, i) => (
											<span key={i}>
												{f.stat} {f.operator} {f.value}
												{i < Math.min(preset.statFilters.length, 3) - 1 && ", "}
											</span>
										))}
										{preset.statFilters.length > 3 && <span> +{preset.statFilters.length - 3} more</span>}
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{matchingPresets.length === 0 && (
				<div className="border-t border-gray-700 pt-3">
					<p className="text-xs text-gray-500">No matching filter presets</p>
				</div>
			)}
		</div>
	);
}

