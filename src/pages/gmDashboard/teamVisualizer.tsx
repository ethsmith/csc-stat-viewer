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
import { useDataContext } from "../../DataContext";

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
	mmr: number;
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
	const [hideUnaffordable, setHideUnaffordable] = React.useState(false);
	const [hoveredPlayer, setHoveredPlayer] = React.useState<string | null>(null);
	const [lockedPlayer, setLockedPlayer] = React.useState<string | null>(null);
	const [hoverPosition, setHoverPosition] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	
	// Show tooltip if player is hovered OR locked
	const activeTooltipPlayer = hoveredPlayer || lockedPlayer;

	const { 
		statsCache, 
		isLoading: isLoadingStats,
		isUsingFallback,
		effectiveSeason 
	} = useStatsWithFallback();

	const { data: playersData } = useCscPlayersCache(effectiveSeason);
	const { ecoRatingMap, ecoDataMap } = useEcoRatings();
	const { tiers, gmRTLCsv } = useDataContext();
	
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

	// Create a map of player name to MMR for quick lookup
	// Prioritize RTL CSV data (gmRTLCsv) over API data when available
	const playerMmrMap = React.useMemo(() => {
		const map: Record<string, number> = {};
		
		// First, populate from API data
		playersData?.forEach(player => {
			if (player.mmr) {
				map[player.name] = player.mmr;
			}
		});
		
		// Override with RTL CSV data if available (more up-to-date)
		if (gmRTLCsv && gmRTLCsv.length > 0) {
			// Build a map of CSC ID to player name for lookup
			const cscIdToName: Record<string, string> = {};
			playersData?.forEach(player => {
				if (player.id) {
					cscIdToName[player.id] = player.name;
				}
			});
			
			gmRTLCsv.forEach(row => {
				const mmrValue = row["MMR"] || row["mmr"];
				if (!mmrValue) return;
				
				const mmr = parseInt(mmrValue, 10);
				if (isNaN(mmr)) return;
				
				// Try to find player by name first
				const playerName = row["Name"] || row["Player Name"] || row["name"];
				if (playerName) {
					map[playerName] = mmr;
					return;
				}
				
				// Fall back to matching by CSC ID
				const cscId = row["CSC ID"] || row["cscId"] || row["Id"];
				if (cscId && cscIdToName[cscId]) {
					map[cscIdToName[cscId]] = mmr;
				}
			});
		}
		
		return map;
	}, [playersData, gmRTLCsv]);

	// Create a set of player names currently in the selected tier (for filtering)
	const playersInSelectedTier = React.useMemo(() => {
		const tierPlayers = new Set<string>();
		playersData?.forEach(player => {
			if (player.tier?.name === selectedTier) {
				tierPlayers.add(player.name.toLowerCase());
			}
		});
		return tierPlayers;
	}, [playersData, selectedTier]);

	// Create unified player list combining CSC and Extended stats
	const unifiedPlayers: UnifiedPlayer[] = React.useMemo(() => {
		const playerMap = new Map<string, UnifiedPlayer>();
		
		// Add CSC players first (only if they're still in the selected tier)
		cscTierPlayers.forEach(player => {
			// Skip players who have moved to a different tier
			if (!playersInSelectedTier.has(player.name.toLowerCase())) return;
			
			const teamDisplay = getPlayerTeamDisplay(player.name, player.team, playersData);
			// Get MMR from playerMmrMap (prioritizes RTL CSV data)
			playerMap.set(player.name.toLowerCase(), {
				name: player.name,
				rating: player.rating || 0,
				games: player.gameCount || 0,
				mmr: playerMmrMap[player.name] || 0,
				source: "csc",
				cscStats: player,
				teamDisplay,
			});
		});
		
		// Add/merge Extended stats (only if they're still in the selected tier)
		extendedTierPlayers.forEach(player => {
			// Skip players who have moved to a different tier
			if (!playersInSelectedTier.has(player.name.toLowerCase())) return;
			
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
					mmr: playerMmrMap[player.name] || 0,
					source: "extended",
					extendedStats: player,
					teamDisplay,
				});
			}
		});
		
		return Array.from(playerMap.values());
	}, [cscTierPlayers, extendedTierPlayers, playersData, playerMmrMap, playersInSelectedTier]);

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

	const handlePlayerHover = (playerName: string, event: React.MouseEvent) => {
		setHoveredPlayer(playerName);
		if (!lockedPlayer) {
			setHoverPosition({ x: event.clientX, y: event.clientY });
		}
	};

	const handlePlayerHoverLeave = () => {
		setHoveredPlayer(null);
	};

	const handlePlayerClick = (playerName: string, event: React.MouseEvent) => {
		// Toggle lock: if clicking the same player that's locked, unlock; otherwise lock this player
		if (lockedPlayer === playerName) {
			setLockedPlayer(null);
		} else {
			setLockedPlayer(playerName);
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

	// Get current tier's MMR cap
	const currentTierData = React.useMemo(() => {
		return tiers.find(t => t.tier.name === selectedTier);
	}, [tiers, selectedTier]);

	const mmrCap = currentTierData?.tier.mmrCap || 0;

	const lineupStats = React.useMemo(() => {
		if (currentLineup.length === 0) return null;
		
		const players = currentLineup.map(name => getUnifiedPlayer(name)).filter(Boolean) as UnifiedPlayer[];
		if (players.length === 0) return null;

		// Calculate averages using CSC stats when available, falling back to extended
		let totalRating = 0, totalAdr = 0, totalKast = 0, totalImpact = 0;
		let totalMmr = 0;
		
		players.forEach(p => {
			totalMmr += p.mmr || 0;
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
			playerCount: players.length,
			totalMmr,
			mmrRemaining: mmrCap - totalMmr,
			isOverCap: totalMmr > mmrCap
		};
	}, [currentLineup, unifiedPlayers, mmrCap]);

	// Apply affordability filter (separate so we can show count before/after)
	const displayedPlayers = React.useMemo(() => {
		if (!hideUnaffordable) return filteredPlayers;
		
		const mmrRemaining = lineupStats?.mmrRemaining ?? mmrCap;
		return filteredPlayers.filter(p => {
			const isInLineup = currentLineup.includes(p.name);
			return isInLineup || p.mmr <= mmrRemaining;
		});
	}, [filteredPlayers, hideUnaffordable, lineupStats, mmrCap, currentLineup]);

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

				<div className="mb-6 text-center">
					<h1 className="text-3xl font-bold text-white mb-2">Team Visualizer</h1>
					<p className="text-gray-400 text-sm">Build your dream 5-man lineup</p>
				</div>

				{/* Main Lineup Display - Top Center */}
				<div className="mb-8">
					<div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl border border-gray-700 p-6">
						<div className="flex justify-between items-center mb-4">
							<div className="flex items-center gap-3">
								<h2 className="text-xl font-bold text-white">Your Lineup</h2>
								<span className="px-3 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">
									{selectedTier || "Select Tier"}
								</span>
							</div>
							<div className="flex gap-2">
								{currentLineup.length > 0 && (
									<>
										<button
											onClick={clearLineup}
											className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
										>
											Clear
										</button>
										<button
											onClick={() => setShowSaveModal(true)}
											className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
										>
											Save Lineup
										</button>
									</>
								)}
							</div>
						</div>
						
						{/* Jersey Display */}
						<div className="flex justify-center items-end gap-4 min-h-[280px] py-4">
							{[0, 1, 2, 3, 4].map((slot) => {
								const playerName = currentLineup[slot];
								const player = playerName ? getUnifiedPlayer(playerName) ?? null : null;
								const matchingPresets = player ? getMatchingPresets(player) : [];
								
								return (
									<JerseyCard
										key={slot}
										slot={slot}
										player={player}
										playerName={playerName}
										matchingPresets={matchingPresets}
										onRemove={() => playerName && removePlayerFromLineup(playerName)}
									/>
								);
							})}
						</div>

						{/* MMR Budget Display */}
						<div className="mt-4 pt-4 border-t border-gray-700">
							<div className="flex justify-center items-center gap-4 mb-4">
								<div className={`text-center px-6 py-3 rounded-lg ${lineupStats?.isOverCap ? 'bg-red-900/50 border border-red-500' : 'bg-gray-800 border border-gray-600'}`}>
									<div className={`text-3xl font-bold ${lineupStats?.isOverCap ? 'text-red-400' : 'text-green-400'}`}>
										{lineupStats?.mmrRemaining ?? mmrCap}
									</div>
									<div className="text-xs text-gray-400">MMR Remaining</div>
								</div>
								<div className="text-center px-4 py-2">
									<div className="text-lg text-gray-300">
										{lineupStats?.totalMmr ?? 0} / {mmrCap}
									</div>
									<div className="text-xs text-gray-500">Total MMR Used</div>
								</div>
							</div>
						</div>

						{/* Team Stats Summary */}
						{lineupStats && (
							<div className="border-t border-gray-700 pt-4">
								<div className="flex justify-center gap-8">
									<div className="text-center">
										<div className="text-2xl font-bold text-yellow-400">{lineupStats.avgRating.toFixed(2)}</div>
										<div className="text-xs text-gray-400">Avg Rating</div>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-white">{lineupStats.avgAdr.toFixed(1)}</div>
										<div className="text-xs text-gray-400">Avg ADR</div>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-white">{lineupStats.avgKast.toFixed(1)}%</div>
										<div className="text-xs text-gray-400">Avg KAST</div>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-white">{lineupStats.avgImpact.toFixed(2)}</div>
										<div className="text-xs text-gray-400">Avg Impact</div>
									</div>
								</div>
							</div>
						)}
					</div>
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
									Available Players ({displayedPlayers.length}{hideUnaffordable && displayedPlayers.length !== filteredPlayers.length ? ` / ${filteredPlayers.length}` : ""})
								</h3>
								<div className="flex items-center gap-3">
									{selectedPresetFilter && (
										<span className="text-xs text-blue-400">
											Filtered by: {selectedPresetFilter}
										</span>
									)}
									<label className="flex items-center gap-2 cursor-pointer">
										<input
											type="checkbox"
											checked={hideUnaffordable}
											onChange={(e) => setHideUnaffordable(e.target.checked)}
											className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
										/>
										<span className="text-xs text-gray-400">Hide Unaffordable</span>
									</label>
								</div>
							</div>
							<div className="max-h-[400px] overflow-y-auto">
								{displayedPlayers.length === 0 ? (
									<div className="p-4 text-center text-gray-500">
										{hideUnaffordable && filteredPlayers.length > 0 
											? "No affordable players match the current filters" 
											: "No players match the current filters"}
									</div>
								) : (
									<div className="divide-y divide-gray-700">
										{displayedPlayers.map(player => {
											const isInLineup = currentLineup.includes(player.name);
											const matchingPresets = getMatchingPresets(player);
											const hasBothStats = player.cscStats && player.extendedStats;
											const mmrRemaining = lineupStats?.mmrRemaining ?? mmrCap;
											const canAfford = isInLineup || player.mmr <= mmrRemaining;
											
											return (
												<div
													key={player.name}
													className={`p-3 flex items-center justify-between hover:bg-gray-750 transition-colors cursor-pointer ${
														isInLineup ? "bg-blue-900/20" : ""
													} ${lockedPlayer === player.name ? "ring-2 ring-yellow-400" : ""} ${!canAfford ? "opacity-50" : ""}`}
													onMouseEnter={(e) => handlePlayerHover(player.name, e)}
													onMouseLeave={handlePlayerHoverLeave}
													onClick={(e) => handlePlayerClick(player.name, e)}
												>
													<div className="flex-1">
														<div className="flex items-center gap-2">
															<span className={`font-medium ${canAfford ? "text-white" : "text-red-400"}`}>{player.name}</span>
															{!canAfford && (
																<span className="px-1.5 py-0.5 text-[10px] bg-red-900/50 text-red-400 rounded font-semibold">
																	OVER CAP
																</span>
															)}
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
															<span className={`text-xs font-medium ${canAfford ? "text-green-400" : "text-red-400"}`}>
																MMR: {player.mmr || "N/A"}
															</span>
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
														onClick={(e) => {
															e.stopPropagation();
															isInLineup ? removePlayerFromLineup(player.name) : addPlayerToLineup(player.name);
														}}
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

					{/* Right Panel - Saved Lineups */}
					<div className="space-y-4">
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

				{/* Player Tooltip - Hover to show, click to lock */}
				{activeTooltipPlayer && getUnifiedPlayer(activeTooltipPlayer) && (
					<UnifiedPlayerHoverTooltip
						player={getUnifiedPlayer(activeTooltipPlayer)!}
						matchingPresets={getMatchingPresets(getUnifiedPlayer(activeTooltipPlayer)!)}
						position={hoverPosition}
						isLocked={lockedPlayer === activeTooltipPlayer}
						onClose={() => {
							setLockedPlayer(null);
							setHoveredPlayer(null);
						}}
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
	isLocked: boolean;
	onClose: () => void;
}

function UnifiedPlayerHoverTooltip({ player, matchingPresets, position, isLocked, onClose }: UnifiedPlayerHoverTooltipProps) {
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
			className={`w-96 bg-gray-900 rounded-lg shadow-xl p-4 ${isLocked ? "border-2 border-yellow-400" : "border border-gray-700"}`}
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

// Jersey Card Component with hover magnification effect
interface JerseyCardProps {
	slot: number;
	player: UnifiedPlayer | null;
	playerName: string | undefined;
	matchingPresets: FilterPreset[];
	onRemove: () => void;
}

function JerseyCard({ slot, player, playerName, matchingPresets, onRemove }: JerseyCardProps) {
	const [isHovered, setIsHovered] = React.useState(false);
	const [isLocked, setIsLocked] = React.useState(false);
	
	// Show stats panel if hovered OR locked
	const showStats = isHovered || isLocked;

	if (!player || !playerName) {
		// Empty slot
		return (
			<div className="flex flex-col items-center">
				<div className="w-32 h-44 bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center transition-all duration-300">
					<div className="text-center">
						<div className="text-4xl text-gray-600 mb-1">+</div>
						<div className="text-sm text-gray-500">Slot {slot + 1}</div>
					</div>
				</div>
			</div>
		);
	}

	const csc = player.cscStats;
	const ext = player.extendedStats;

	return (
		<div 
			className="flex flex-col items-center relative"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{/* Jersey Card */}
			<div 
				className={`relative transition-all duration-300 ease-out cursor-pointer ${
					showStats 
						? "transform scale-110 z-20" 
						: "transform scale-100 z-10 hover:scale-105"
				}`}
				onClick={() => setIsLocked(!isLocked)}
			>
				{/* Jersey Shape */}
				<div className={`w-36 bg-gradient-to-b from-blue-600 to-blue-800 rounded-t-3xl rounded-b-lg shadow-lg border-2 transition-all duration-300 ${
					isLocked ? "border-yellow-400 shadow-yellow-500/30 shadow-xl" : showStats ? "border-blue-500 shadow-blue-500/50 shadow-xl" : "border-blue-500"
				}`}>
					{/* Jersey Number */}
					<div className="pt-3 pb-2 text-center">
						<span className="text-5xl font-black text-white/90 drop-shadow-lg" style={{ fontFamily: "Impact, sans-serif" }}>
							{slot + 1}
						</span>
					</div>
					
					{/* Player Name */}
					<div className="bg-white/10 py-3 px-2">
						<div className="text-center">
							<span className="text-sm font-bold text-white uppercase tracking-wide truncate block">
								{playerName.length > 14 ? playerName.substring(0, 12) + "..." : playerName}
							</span>
						</div>
					</div>

					{/* Rating Badge */}
					<div className="py-3 text-center">
						<span className="px-3 py-1 bg-yellow-500 text-black text-sm font-bold rounded">
							{player.rating?.toFixed(2)}
						</span>
					</div>

					{/* Stats Source Badges */}
					<div className="flex justify-center gap-1 pb-3">
						{csc && <span className="px-1.5 py-0.5 text-[10px] bg-blue-900 text-blue-300 rounded">CSC</span>}
						{ext && <span className="px-1.5 py-0.5 text-[10px] bg-purple-900 text-purple-300 rounded">EXT</span>}
					</div>

					{/* Remove Button */}
					<button
						onClick={(e) => {
							e.stopPropagation();
							onRemove();
						}}
						className="absolute -top-2 -right-2 w-7 h-7 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
					>
						<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
						</svg>
					</button>
				</div>

				{/* Expanded Stats Panel - Shows on Hover or when Locked */}
				{showStats && (
					<div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-3 w-80 bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-4 z-30">
						<div className="text-base font-bold text-white mb-3 border-b border-gray-700 pb-2">
							{playerName}
						</div>
						
						{/* CSC Stats */}
						{csc && (
							<div className="mb-3">
								<div className="text-xs font-medium text-blue-400 mb-2">CSC Stats</div>
								<div className="grid grid-cols-4 gap-2 text-xs">
									<div><span className="text-gray-400">ADR:</span> <span className="text-white">{csc.adr?.toFixed(1)}</span></div>
									<div><span className="text-gray-400">KAST:</span> <span className="text-white">{csc.kast?.toFixed(1)}%</span></div>
									<div><span className="text-gray-400">K/R:</span> <span className="text-white">{csc.kr?.toFixed(2)}</span></div>
									<div><span className="text-gray-400">Impact:</span> <span className="text-white">{csc.impact?.toFixed(2)}</span></div>
									<div><span className="text-gray-400">HS%:</span> <span className="text-white">{csc.hs?.toFixed(1)}%</span></div>
									<div><span className="text-gray-400">Games:</span> <span className="text-white">{csc.gameCount}</span></div>
									<div><span className="text-gray-400">OD%:</span> <span className="text-white">{csc.odr?.toFixed(1)}%</span></div>
									<div><span className="text-gray-400">Clutch:</span> <span className="text-white">{csc.clutchR?.toFixed(2)}</span></div>
								</div>
							</div>
						)}

						{/* Extended Stats */}
						{ext && (
							<div className="mb-3">
								<div className="text-xs font-medium text-purple-400 mb-2">Extended Stats</div>
								<div className="grid grid-cols-4 gap-2 text-xs">
									<div><span className="text-gray-400">Rating:</span> <span className="text-white">{ext.final_rating?.toFixed(2)}</span></div>
									<div><span className="text-gray-400">ADR:</span> <span className="text-white">{ext.adr?.toFixed(1)}</span></div>
									<div><span className="text-gray-400">KPR:</span> <span className="text-white">{ext.kpr?.toFixed(2)}</span></div>
									<div><span className="text-gray-400">DPR:</span> <span className="text-white">{ext.dpr?.toFixed(2)}</span></div>
									<div><span className="text-gray-400">OK/R:</span> <span className="text-white">{ext.opening_kills_per_round?.toFixed(2)}</span></div>
									<div><span className="text-gray-400">Clutch:</span> <span className="text-white">{ext.clutch_wins}/{ext.clutch_rounds}</span></div>
									<div><span className="text-gray-400">Impact:</span> <span className="text-white">{ext.round_impact?.toFixed(2)}</span></div>
									<div><span className="text-gray-400">Games:</span> <span className="text-white">{ext.games_count}</span></div>
								</div>
							</div>
						)}

						{/* Matching Presets with Filter Details */}
						{matchingPresets.length > 0 && (
							<div className="border-t border-gray-700 pt-3 mt-2">
								<div className="text-xs font-medium text-gray-400 mb-2">Matching Filter Presets:</div>
								<div className="space-y-2 max-h-40 overflow-y-auto">
									{matchingPresets.map(preset => (
										<div 
											key={preset.name}
											className={`p-2 rounded ${
												preset.statsSource === "extended" 
													? "bg-purple-900/30 border border-purple-800" 
													: "bg-green-900/30 border border-green-800"
											}`}
										>
											<div className={`text-sm font-medium mb-1 ${
												preset.statsSource === "extended" ? "text-purple-300" : "text-green-300"
											}`}>
												{preset.name}
											</div>
											{preset.statFilters.length > 0 && (
												<div className="text-[10px] text-gray-400">
													{preset.statFilters.map((f, i) => (
														<span key={i}>
															{f.stat} {f.operator} {f.value}
															{i < preset.statFilters.length - 1 && ", "}
														</span>
													))}
												</div>
											)}
											{preset.minGames > 0 && (
												<div className="text-[10px] text-gray-500">Min games: {preset.minGames}</div>
											)}
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

