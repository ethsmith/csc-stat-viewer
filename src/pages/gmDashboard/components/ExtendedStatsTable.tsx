import * as React from "react";
import { Link } from "wouter";
import { ExtendedPlayerStats, EXTENDED_STATS_COLUMNS, EXTENDED_STATS_CATEGORIES, MapName } from "../hooks/useExtendedStats";
import { getPlayerTeamDisplay, parseColorblindColors } from "../utils";
import { CscPlayer } from "../../../models/csc-player-types";

// Map names for display
const MAP_NAMES: MapName[] = ["de_nuke", "de_anubis", "de_dust2", "de_inferno", "de_overpass", "de_ancient", "de_mirage", "de_train"];

type ExtendedSortColumn = keyof ExtendedPlayerStats | "name" | `mapRating_${MapName}` | `mapGames_${MapName}`;
type ExtendedFilterStat = keyof ExtendedPlayerStats | `mapRating_${MapName}` | `mapGames_${MapName}`;

interface FilterPreset {
	name: string;
	teamFilter: string;
	minGames: number;
	statFilters: Array<{ stat: string; operator: "<" | ">" | "<=" | ">=" | "="; value: number }>;
	sortColumn: string;
	sortDirection: "asc" | "desc";
	statsSource?: "csc" | "extended";
}

interface ExtendedStatsTableProps {
	players: ExtendedPlayerStats[];
	statsByTier: Record<string, ExtendedPlayerStats[]>;
	selectedTier: string;
	playersData?: CscPlayer[];
	colorblindMode: boolean;
	colorblindColors: string;
	savedFilterPresets: string;
	setSavedFilterPresets: (value: string) => void;
}

const formatMapName = (mapName: MapName): string => {
	return mapName.replace("de_", "").charAt(0).toUpperCase() + mapName.replace("de_", "").slice(1);
};

export function ExtendedStatsTable({
	players,
	statsByTier,
	selectedTier,
	playersData,
	colorblindMode,
	colorblindColors,
	savedFilterPresets,
	setSavedFilterPresets,
}: ExtendedStatsTableProps) {
	// Local state
	const [sortColumn, setSortColumn] = React.useState<ExtendedSortColumn>("final_rating");
	const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");
	const [teamFilter, setTeamFilter] = React.useState<string>("");
	const [minGames, setMinGames] = React.useState<number>(0);
	const [statFilters, setStatFilters] = React.useState<Array<{ stat: ExtendedFilterStat; operator: "<" | ">" | "<=" | ">=" | "="; value: number }>>([]);
	const [showFilters, setShowFilters] = React.useState(false);
	const [showSavePresetModal, setShowSavePresetModal] = React.useState(false);
	const [newPresetName, setNewPresetName] = React.useState("");
	const [selectedCategory, setSelectedCategory] = React.useState<string>("Core");
	const [comparePlayer, setComparePlayer] = React.useState<string>("");
	const [playerSearchQuery, setPlayerSearchQuery] = React.useState("");
	const [selectedPlayers, setSelectedPlayers] = React.useState<string[]>([]);
	const [showPlayerDropdown, setShowPlayerDropdown] = React.useState(false);
	const [statFilterSearchQuery, setStatFilterSearchQuery] = React.useState("");
	const [activeStatFilterIndex, setActiveStatFilterIndex] = React.useState<number | null>(null);

	// Get columns for selected category
	const visibleColumns = React.useMemo(() => {
		return EXTENDED_STATS_COLUMNS.filter(col => col.category === selectedCategory);
	}, [selectedCategory]);

	// Get players whose CURRENT tier matches the selected tier, with stats from that tier
	// This ensures players only appear in their current tier and show the correct tier's stats
	const currentTierPlayers = React.useMemo(() => {
		if (!playersData) return players;
		
		// Get all players whose current roster tier matches the selected tier
		const playersInCurrentTier = playersData.filter(pd => pd.tier?.name === selectedTier);
		
		// For each player in the current tier, find their stats from the selected tier in the spreadsheet
		const result: ExtendedPlayerStats[] = [];
		const tierStats = statsByTier[selectedTier] || [];
		
		playersInCurrentTier.forEach(pd => {
			// Look for this player's stats in the selected tier
			const playerStats = tierStats.find(s => s.name.toLowerCase() === pd.name.toLowerCase());
			if (playerStats) {
				result.push(playerStats);
			}
		});
		
		return result;
	}, [players, playersData, selectedTier, statsByTier]);

	// Get available teams
	const availableTeams = React.useMemo(() => {
		const teams = new Set<string>();
		currentTierPlayers.forEach(p => {
			const teamDisplay = getPlayerTeamDisplay(p.name, undefined, playersData);
			if (teamDisplay) teams.add(teamDisplay);
		});
		return Array.from(teams).sort();
	}, [currentTierPlayers, playersData]);

	// Search filtered players for dropdown
	const searchFilteredPlayers = React.useMemo(() => {
		if (!playerSearchQuery) return currentTierPlayers;
		const query = playerSearchQuery.toLowerCase();
		return currentTierPlayers.filter(p => p.name.toLowerCase().includes(query));
	}, [currentTierPlayers, playerSearchQuery]);

	// Filter players
	const filteredPlayers = React.useMemo(() => {
		let result = currentTierPlayers;

		// Apply selected players filter
		if (selectedPlayers.length > 0) {
			result = result.filter(p => selectedPlayers.includes(p.name));
		}

		// Apply team filter
		if (teamFilter) {
			result = result.filter(p => getPlayerTeamDisplay(p.name, undefined, playersData) === teamFilter);
		}

		// Apply min games filter
		if (minGames > 0) {
			result = result.filter(p => p.games_count >= minGames);
		}

		// Apply stat filters
		statFilters.forEach(filter => {
			result = result.filter(p => {
				let val: number | undefined;
				if (filter.stat.startsWith("mapRating_")) {
					const mapName = filter.stat.replace("mapRating_", "") as MapName;
					val = p.map_ratings[mapName];
				} else if (filter.stat.startsWith("mapGames_")) {
					const mapName = filter.stat.replace("mapGames_", "") as MapName;
					val = p.map_games_played[mapName];
				} else {
					val = p[filter.stat as keyof ExtendedPlayerStats] as number | undefined;
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

		return result;
	}, [currentTierPlayers, selectedPlayers, teamFilter, minGames, statFilters, playersData]);

	// Sort players
	const sortedPlayers = React.useMemo(() => {
		return [...filteredPlayers].sort((a, b) => {
			let aVal: string | number | undefined;
			let bVal: string | number | undefined;

			if (sortColumn === "name") {
				aVal = a.name.toLowerCase();
				bVal = b.name.toLowerCase();
			} else if (sortColumn.startsWith("mapRating_")) {
				const mapName = sortColumn.replace("mapRating_", "") as MapName;
				aVal = a.map_ratings[mapName];
				bVal = b.map_ratings[mapName];
			} else if (sortColumn.startsWith("mapGames_")) {
				const mapName = sortColumn.replace("mapGames_", "") as MapName;
				aVal = a.map_games_played[mapName];
				bVal = b.map_games_played[mapName];
			} else {
				aVal = a[sortColumn as keyof ExtendedPlayerStats] as number | string | undefined;
				bVal = b[sortColumn as keyof ExtendedPlayerStats] as number | string | undefined;
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

			return sortDirection === "asc" ? comparison : -comparison;
		});
	}, [filteredPlayers, sortColumn, sortDirection]);

	// Compare player stats
	const comparePlayerStats = React.useMemo(() => {
		if (!comparePlayer) return null;
		return currentTierPlayers.find(p => p.name === comparePlayer) || null;
	}, [comparePlayer, currentTierPlayers]);

	const handleSort = (column: ExtendedSortColumn) => {
		if (sortColumn === column) {
			setSortDirection(prev => prev === "asc" ? "desc" : "asc");
		} else {
			setSortColumn(column);
			setSortDirection(column === "name" ? "asc" : "desc");
		}
	};

	const getSortIndicator = (column: ExtendedSortColumn) => {
		if (sortColumn !== column) return null;
		return sortDirection === "asc" ? " ▲" : " ▼";
	};

	const togglePlayerSelection = (playerName: string) => {
		setSelectedPlayers(prev =>
			prev.includes(playerName)
				? prev.filter(n => n !== playerName)
				: [...prev, playerName]
		);
	};

	// Preset management
	const parsedPresets: FilterPreset[] = React.useMemo(() => {
		try {
			return JSON.parse(savedFilterPresets);
		} catch {
			return [];
		}
	}, [savedFilterPresets]);

	const saveCurrentPreset = () => {
		if (!newPresetName.trim()) return;
		const newPreset: FilterPreset = {
			name: newPresetName.trim(),
			teamFilter,
			minGames,
			statFilters: statFilters.map(f => ({ ...f, stat: f.stat as string })),
			sortColumn: sortColumn as string,
			sortDirection,
			statsSource: "extended",
		};
		const existingIndex = parsedPresets.findIndex(p => p.name === newPreset.name);
		let updatedPresets: FilterPreset[];
		if (existingIndex >= 0) {
			updatedPresets = [...parsedPresets];
			updatedPresets[existingIndex] = newPreset;
		} else {
			updatedPresets = [...parsedPresets, newPreset];
		}
		setSavedFilterPresets(JSON.stringify(updatedPresets));
		setNewPresetName("");
		setShowSavePresetModal(false);
	};

	const loadPreset = (preset: FilterPreset) => {
		setTeamFilter(preset.teamFilter);
		setMinGames(preset.minGames);
		setStatFilters(preset.statFilters.map(f => ({ ...f, stat: f.stat as ExtendedFilterStat })));
		setSortColumn(preset.sortColumn as ExtendedSortColumn);
		setSortDirection(preset.sortDirection);
	};

	const deletePreset = (presetName: string) => {
		const updatedPresets = parsedPresets.filter(p => p.name !== presetName);
		setSavedFilterPresets(JSON.stringify(updatedPresets));
	};

	// Filter presets to only show extended stats presets
	const extendedPresets = parsedPresets.filter(p => p.statsSource === "extended");

	const getComparisonColor = (
		value: number | undefined,
		compareValue: number | undefined,
		statKey: string
	): { className: string; style?: React.CSSProperties } => {
		if (value === undefined || compareValue === undefined) {
			return { className: "text-gray-400" };
		}

		const colors = parseColorblindColors(colorblindColors);
		const lowerIsBetter = ["deaths", "dpr", "opening_deaths", "eco_death_value", "awp_deaths", "early_deaths", "team_flash_count", "team_flash_duration_per_round"].includes(statKey);

		let comparison: "above" | "at" | "below";
		if (lowerIsBetter) {
			if (value < compareValue) comparison = "above";
			else if (value > compareValue) comparison = "below";
			else comparison = "at";
		} else {
			if (value > compareValue) comparison = "above";
			else if (value < compareValue) comparison = "below";
			else comparison = "at";
		}

		if (colorblindMode) {
			switch (comparison) {
				case "above":
					return { className: "", style: { color: colors.good } };
				case "at":
					return { className: "", style: { color: colors.atTarget || "#60a5fa" } };
				case "below":
					return { className: "", style: { color: colors.bad } };
			}
		} else {
			switch (comparison) {
				case "above":
					return { className: "text-green-400" };
				case "at":
					return { className: "text-blue-400" };
				case "below":
					return { className: "text-red-400" };
			}
		}
	};

	const formatValue = (value: number | undefined): string => {
		if (value === undefined) return "-";
		if (Number.isInteger(value)) return value.toString();
		return value.toFixed(2);
	};

	return (
		<div>
			{/* Controls */}
			<div className="flex flex-wrap gap-4 items-end mb-4">
				<div>
					<label className="block text-sm text-gray-400 mb-1">Compare To Player</label>
					<select
						value={comparePlayer}
						onChange={(e) => setComparePlayer(e.target.value)}
						className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 min-w-[200px]"
					>
						<option value="">Select a player to compare...</option>
						{currentTierPlayers
							.sort((a, b) => b.final_rating - a.final_rating)
							.map(player => (
								<option key={player.name} value={player.name}>
									{player.name} ({player.final_rating.toFixed(2)})
								</option>
							))}
					</select>
				</div>

				<div className="relative">
					<label className="block text-sm text-gray-400 mb-1">Filter Players</label>
					<input
						type="text"
						placeholder="Search to add players..."
						value={playerSearchQuery}
						onChange={(e) => setPlayerSearchQuery(e.target.value)}
						onFocus={() => setShowPlayerDropdown(true)}
						className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 min-w-[250px]"
					/>
					{showPlayerDropdown && (
						<>
							<div
								className="fixed inset-0 z-10"
								onClick={() => setShowPlayerDropdown(false)}
							/>
							<div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20">
								{searchFilteredPlayers
									.sort((a, b) => b.final_rating - a.final_rating)
									.slice(0, 20)
									.map(player => (
										<button
											key={player.name}
											onClick={() => togglePlayerSelection(player.name)}
											className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center justify-between ${selectedPlayers.includes(player.name) ? "bg-blue-900/30" : ""
												}`}
										>
											<span className="text-white">{player.name}</span>
											<span className="text-gray-400 text-xs">
												{player.final_rating.toFixed(2)}
												{selectedPlayers.includes(player.name) && <span className="ml-2 text-blue-400">✓</span>}
											</span>
										</button>
									))}
								{searchFilteredPlayers.length === 0 && (
									<div className="px-3 py-2 text-gray-400 text-sm">No players found</div>
								)}
							</div>
						</>
					)}
				</div>

				<div>
					<label className="block text-sm text-gray-400 mb-1">Stat Category</label>
					<select
						value={selectedCategory}
						onChange={(e) => setSelectedCategory(e.target.value)}
						className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
					>
						{EXTENDED_STATS_CATEGORIES.map(cat => (
							<option key={cat} value={cat}>{cat}</option>
						))}
					</select>
				</div>

				{comparePlayer && (
					<button
						onClick={() => setComparePlayer("")}
						className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
					>
						Clear Comparison
					</button>
				)}

				{selectedPlayers.length > 0 && (
					<button
						onClick={() => setSelectedPlayers([])}
						className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
					>
						Clear Filter ({selectedPlayers.length})
					</button>
				)}

				<button
					onClick={() => setShowFilters(!showFilters)}
					className={`px-4 py-2 rounded-lg transition-colors ${showFilters ? "bg-blue-600 hover:bg-blue-500" : "bg-gray-700 hover:bg-gray-600"} text-white`}
				>
					{showFilters ? "Hide Filters" : "More Filters"}
				</button>
			</div>

			{/* Filters Panel */}
			{showFilters && (
				<div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
					<h3 className="text-sm font-bold text-white mb-3">Filters & Sorting</h3>
					<div className="flex flex-wrap gap-4 items-end">
						<div>
							<label className="block text-sm text-gray-400 mb-1">Filter by Team</label>
							<select
								value={teamFilter}
								onChange={(e) => setTeamFilter(e.target.value)}
								className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 min-w-[180px]"
							>
								<option value="">All Teams</option>
								{availableTeams.map(team => (
									<option key={team} value={team}>{team}</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-sm text-gray-400 mb-1">Min Games Played</label>
							<input
								type="number"
								min="0"
								value={minGames}
								onChange={(e) => setMinGames(Math.max(0, parseInt(e.target.value) || 0))}
								className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 w-24"
							/>
						</div>

						<div>
							<label className="block text-sm text-gray-400 mb-1">Sort By</label>
							<div className="flex gap-2">
								<select
									value={sortColumn}
									onChange={(e) => setSortColumn(e.target.value as ExtendedSortColumn)}
									className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 min-w-[150px]"
								>
									<option value="name">Player Name</option>
									{EXTENDED_STATS_CATEGORIES.map(cat => (
										<optgroup key={cat} label={cat}>
											{EXTENDED_STATS_COLUMNS.filter(c => c.category === cat).map(col => (
												<option key={col.key} value={col.key}>{col.label}</option>
											))}
										</optgroup>
									))}
									<optgroup label="Map Ratings">
										{MAP_NAMES.map(mapName => (
											<option key={`mapRating_${mapName}`} value={`mapRating_${mapName}`}>{formatMapName(mapName)} Rating</option>
										))}
									</optgroup>
									<optgroup label="Map Games">
										{MAP_NAMES.map(mapName => (
											<option key={`mapGames_${mapName}`} value={`mapGames_${mapName}`}>{formatMapName(mapName)} Games</option>
										))}
									</optgroup>
								</select>
								<button
									onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
									className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white hover:bg-gray-600 transition-colors min-w-[80px]"
								>
									{sortDirection === "asc" ? "▲ Asc" : "▼ Desc"}
								</button>
							</div>
						</div>

						{(teamFilter || minGames > 0 || statFilters.length > 0) && (
							<button
								onClick={() => {
									setTeamFilter("");
									setMinGames(0);
									setStatFilters([]);
								}}
								className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
							>
								Clear All Filters
							</button>
						)}
					</div>

					{/* Saved Presets */}
					<div className="mt-4 pt-4 border-t border-gray-600">
						<div className="flex items-center justify-between mb-3">
							<h4 className="text-sm font-medium text-white">Saved Presets (Extended Stats)</h4>
							<button
								onClick={() => setShowSavePresetModal(true)}
								className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
							>
								+ Save Current
							</button>
						</div>
						{extendedPresets.length === 0 ? (
							<p className="text-gray-500 text-sm">No saved presets for extended stats.</p>
						) : (
							<div className="flex flex-wrap gap-2">
								{extendedPresets.map(preset => (
									<div key={preset.name} className="inline-flex items-center gap-1 bg-gray-700 rounded-lg overflow-hidden">
										<button
											onClick={() => loadPreset(preset)}
											className="px-3 py-1.5 text-white text-sm hover:bg-gray-600 transition-colors"
										>
											{preset.name}
										</button>
										<button
											onClick={() => deletePreset(preset.name)}
											className="px-2 py-1.5 text-red-400 hover:bg-red-600 hover:text-white text-sm transition-colors"
										>
											×
										</button>
									</div>
								))}
							</div>
						)}
					</div>

					{/* Stat Filters */}
					<div className="mt-4 pt-4 border-t border-gray-600">
						<div className="flex items-center justify-between mb-3">
							<h4 className="text-sm font-medium text-white">Stat Filters</h4>
							<button
								onClick={() => setStatFilters([...statFilters, { stat: "final_rating", operator: ">=", value: 0 }])}
								className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
							>
								+ Add Filter
							</button>
						</div>
						{statFilters.length === 0 ? (
							<p className="text-gray-500 text-sm">No stat filters applied.</p>
						) : (
							<div className="space-y-2">
								{statFilters.map((filter, index) => (
									<div key={index} className="flex items-center gap-2 flex-wrap">
										{/* Searchable Stat Dropdown */}
										<div className="relative">
											<input
												type="text"
												value={activeStatFilterIndex === index ? statFilterSearchQuery : ""}
												onChange={(e) => {
													setStatFilterSearchQuery(e.target.value);
													setActiveStatFilterIndex(index);
												}}
												onFocus={() => setActiveStatFilterIndex(index)}
												placeholder={(() => {
													if (filter.stat.startsWith("mapRating_")) return `${formatMapName(filter.stat.replace("mapRating_", "") as MapName)} Rating`;
													if (filter.stat.startsWith("mapGames_")) return `${formatMapName(filter.stat.replace("mapGames_", "") as MapName)} Games`;
													return EXTENDED_STATS_COLUMNS.find(c => c.key === filter.stat)?.label || filter.stat;
												})()}
												className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 min-w-[180px] placeholder-gray-300"
											/>
											{activeStatFilterIndex === index && (
												<>
													<div
														className="fixed inset-0 z-40"
														onClick={() => {
															setActiveStatFilterIndex(null);
															setStatFilterSearchQuery("");
														}}
													/>
													<div className="absolute top-full left-0 mt-1 w-72 max-h-60 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
														{(() => {
															const query = statFilterSearchQuery.toLowerCase();
															const matchingColumns = EXTENDED_STATS_COLUMNS.filter(c => 
																c.label.toLowerCase().includes(query) || c.key.toLowerCase().includes(query)
															);
															const matchingMapRatings = MAP_NAMES.filter(m => 
																formatMapName(m).toLowerCase().includes(query) || "rating".includes(query)
															);
															
															const hasResults = matchingColumns.length > 0 || matchingMapRatings.length > 0;
															
															if (!hasResults && query) {
																return <div className="px-3 py-2 text-gray-500 text-sm">No stats found</div>;
															}
															
															// Group matching columns by category
															const groupedColumns: Record<string, typeof matchingColumns> = {};
															(query ? matchingColumns : EXTENDED_STATS_COLUMNS).forEach(col => {
																if (!groupedColumns[col.category]) groupedColumns[col.category] = [];
																groupedColumns[col.category].push(col);
															});
															
															return (
																<>
																	{EXTENDED_STATS_CATEGORIES.filter(cat => groupedColumns[cat]?.length > 0).map(cat => (
																		<React.Fragment key={cat}>
																			<div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-750 sticky top-0">{cat}</div>
																			{groupedColumns[cat].slice(0, query ? 50 : 10).map(col => (
																				<button
																					key={col.key}
																					onClick={() => {
																						const newFilters = [...statFilters];
																						newFilters[index] = { ...filter, stat: col.key as ExtendedFilterStat };
																						setStatFilters(newFilters);
																						setActiveStatFilterIndex(null);
																						setStatFilterSearchQuery("");
																					}}
																					className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-white ${filter.stat === col.key ? "bg-blue-900/30" : ""}`}
																				>
																					{col.label}
																				</button>
																			))}
																		</React.Fragment>
																	))}
																	{(matchingMapRatings.length > 0 || !query) && (
																		<>
																			<div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-750 sticky top-0">Map Ratings</div>
																			{(query ? matchingMapRatings : MAP_NAMES).map(mapName => (
																				<button
																					key={`mapRating_${mapName}`}
																					onClick={() => {
																						const newFilters = [...statFilters];
																						newFilters[index] = { ...filter, stat: `mapRating_${mapName}` as ExtendedFilterStat };
																						setStatFilters(newFilters);
																						setActiveStatFilterIndex(null);
																						setStatFilterSearchQuery("");
																					}}
																					className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-white ${filter.stat === `mapRating_${mapName}` ? "bg-blue-900/30" : ""}`}
																				>
																					{formatMapName(mapName)} Rating
																				</button>
																			))}
																		</>
																	)}
																	{!query && (
																		<div className="px-3 py-1 text-xs text-gray-500">Type to search more stats...</div>
																	)}
																</>
															);
														})()}
													</div>
												</>
											)}
										</div>
										<select
											value={filter.operator}
											onChange={(e) => {
												const newFilters = [...statFilters];
												newFilters[index] = { ...filter, operator: e.target.value as "<" | ">" | "<=" | ">=" | "=" };
												setStatFilters(newFilters);
											}}
											className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 w-20"
										>
											<option value=">">&gt;</option>
											<option value=">=">&gt;=</option>
											<option value="<">&lt;</option>
											<option value="<=">&lt;=</option>
											<option value="=">=</option>
										</select>
										<input
											type="number"
											step="any"
											value={filter.value}
											onChange={(e) => {
												const newFilters = [...statFilters];
												newFilters[index] = { ...filter, value: parseFloat(e.target.value) || 0 };
												setStatFilters(newFilters);
											}}
											className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 w-24"
										/>
										<button
											onClick={() => setStatFilters(statFilters.filter((_, i) => i !== index))}
											className="px-2 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
										>
											×
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Save Preset Modal */}
			{showSavePresetModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-700">
						<h3 className="text-lg font-bold text-white mb-4">Save Filter Preset</h3>
						<input
							type="text"
							placeholder="Enter preset name..."
							value={newPresetName}
							onChange={(e) => setNewPresetName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && saveCurrentPreset()}
							className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
							autoFocus
						/>
						<div className="flex gap-2 justify-end">
							<button
								onClick={() => {
									setShowSavePresetModal(false);
									setNewPresetName("");
								}}
								className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={saveCurrentPreset}
								disabled={!newPresetName.trim()}
								className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
							>
								Save
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Selected Players Display */}
			{selectedPlayers.length > 0 && (
				<div className="mb-3 flex flex-wrap gap-2">
					<span className="text-gray-400 text-sm">Showing:</span>
					{selectedPlayers.map(name => (
						<span
							key={name}
							className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 text-white text-sm rounded-lg"
						>
							{name}
							<button
								onClick={() => togglePlayerSelection(name)}
								className="hover:text-red-400 transition-colors ml-1"
							>
								×
							</button>
						</span>
					))}
				</div>
			)}

			{/* Comparison Info */}
			{comparePlayer && comparePlayerStats && (
				<div className="mb-4 p-3 bg-blue-900/30 border border-blue-600 rounded-lg">
					<span className="text-blue-200 text-sm">
						Comparing all players to: <strong>{comparePlayer}</strong> (Rating: {comparePlayerStats.final_rating.toFixed(2)})
					</span>
				</div>
			)}

			{/* Tier Averages Section */}
			{currentTierPlayers.length > 0 && (
				<div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
					<h3 className="text-sm font-bold text-white mb-3">{selectedTier} Tier Averages</h3>
					<div className="flex flex-wrap gap-6">
						{(() => {
							const playersWithStats = currentTierPlayers.filter(p => p.kpr !== undefined && p.rounds_played > 0);
							const avgKpr = playersWithStats.length > 0
								? playersWithStats.reduce((sum, p) => sum + (p.kpr || 0), 0) / playersWithStats.length
								: 0;
							const avgDpr = playersWithStats.length > 0
								? playersWithStats.reduce((sum, p) => sum + (p.dpr || 0), 0) / playersWithStats.length
								: 0;
							const avgAdr = playersWithStats.length > 0
								? playersWithStats.reduce((sum, p) => sum + (p.adr || 0), 0) / playersWithStats.length
								: 0;
							const avgKast = playersWithStats.length > 0
								? playersWithStats.reduce((sum, p) => sum + (p.kast || 0), 0) / playersWithStats.length
								: 0;
							
							return (
								<>
									<div className="flex items-center gap-2">
										<span className="text-gray-400 text-sm">KPR:</span>
										<span className="text-white font-medium">{avgKpr.toFixed(2)}</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-gray-400 text-sm">DPR:</span>
										<span className="text-white font-medium">{avgDpr.toFixed(2)}</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-gray-400 text-sm">ADR:</span>
										<span className="text-white font-medium">{avgAdr.toFixed(1)}</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-gray-400 text-sm">KAST:</span>
										<span className="text-white font-medium">{(avgKast * 100).toFixed(1)}%</span>
									</div>
									<div className="text-gray-500 text-xs ml-4">
										Based on {playersWithStats.length} players
									</div>
								</>
							);
						})()}
					</div>
				</div>
			)}

			{/* Color Legend */}
			<div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
				<h3 className="text-sm font-bold text-white mb-2">Color Legend</h3>
				<div className="flex gap-6 text-sm">
					<div className="flex items-center gap-2">
						<div
							className={`w-4 h-4 rounded ${!colorblindMode ? "bg-green-400" : ""}`}
							style={colorblindMode ? { backgroundColor: parseColorblindColors(colorblindColors).good } : {}}
						></div>
						<span className="text-gray-300">Higher than compared player</span>
					</div>
					<div className="flex items-center gap-2">
						<div
							className={`w-4 h-4 rounded ${!colorblindMode ? "bg-blue-400" : ""}`}
							style={colorblindMode ? { backgroundColor: parseColorblindColors(colorblindColors).atTarget } : {}}
						></div>
						<span className="text-gray-300">Same as compared player</span>
					</div>
					<div className="flex items-center gap-2">
						<div
							className={`w-4 h-4 rounded ${!colorblindMode ? "bg-red-400" : ""}`}
							style={colorblindMode ? { backgroundColor: parseColorblindColors(colorblindColors).bad } : {}}
						></div>
						<span className="text-gray-300">Lower than compared player</span>
					</div>
				</div>
			</div>

			{/* Table */}
			<div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
				<div className="overflow-auto max-h-[calc(100vh-450px)]">
					<table className="w-full text-sm border-separate border-spacing-0">
						<thead className="bg-gray-900">
							<tr>
								<th
									className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sticky left-0 top-0 bg-gray-900 z-40 min-w-[150px] cursor-pointer hover:text-white transition-colors select-none"
									onClick={() => handleSort("name")}
								>
									Player{getSortIndicator("name")}
								</th>
								<th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[80px] bg-gray-900 sticky top-0 z-20">
									Team
								</th>
								<th
									className="px-2 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[60px] cursor-pointer hover:text-white transition-colors select-none bg-gray-900 sticky top-0 z-20"
									onClick={() => handleSort("games_count")}
								>
									Games{getSortIndicator("games_count")}
								</th>
								{visibleColumns.map(col => (
									<th
										key={col.key}
										className="px-2 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[70px] cursor-pointer hover:text-white transition-colors select-none bg-gray-900 sticky top-0 z-20"
										onClick={() => handleSort(col.key as ExtendedSortColumn)}
									>
										{col.label}{getSortIndicator(col.key as ExtendedSortColumn)}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-700">
							{sortedPlayers.length > 0 ? (
								sortedPlayers.map(player => {
									const isComparePlayer = player.name === comparePlayer;
									return (
										<tr
											key={`${player.name}-${player.tier}`}
											className={`hover:bg-gray-750 ${isComparePlayer ? "bg-blue-900/20" : ""}`}
										>
											<td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-gray-800 z-[5]">
												<Link href={`/players/${player.name}`}>
													<span className={`font-medium hover:text-blue-400 cursor-pointer transition-colors ${isComparePlayer ? "text-blue-300" : "text-white"}`}>
														{player.name}
														{isComparePlayer && <span className="ml-2 text-xs text-blue-400">(comparing)</span>}
													</span>
												</Link>
											</td>
											<td className="px-3 py-2 whitespace-nowrap text-gray-400">
												{getPlayerTeamDisplay(player.name, undefined, playersData)}
											</td>
											<td className="px-2 py-2 text-center whitespace-nowrap text-gray-300">
												{player.games_count}
											</td>
											{visibleColumns.map(col => {
												const value = player[col.key] as number | undefined;
												const compareValue = comparePlayerStats?.[col.key] as number | undefined;
												const colorInfo = comparePlayer && !isComparePlayer
													? getComparisonColor(value, compareValue, col.key)
													: { className: "text-gray-300" };

												return (
													<td
														key={col.key}
														className={`px-2 py-2 text-center whitespace-nowrap ${colorInfo.className}`}
														style={colorInfo.style}
													>
														{formatValue(value)}
													</td>
												);
											})}
										</tr>
									);
								})
							) : (
								<tr>
									<td colSpan={visibleColumns.length + 3} className="px-6 py-8 text-center text-gray-400">
										No players found in this tier
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			<div className="mt-4 text-sm text-gray-500">
				Showing {sortedPlayers.length} of {currentTierPlayers.length} players in {selectedTier}
				{(teamFilter || minGames > 0 || statFilters.length > 0) && (
					<span className="ml-2">
						(Filtered{teamFilter && ` by ${teamFilter}`}{minGames > 0 && ` with ≥${minGames} games`}{statFilters.length > 0 && ` with ${statFilters.length} stat filter${statFilters.length > 1 ? "s" : ""}`})
					</span>
				)}
			</div>
		</div>
	);
}
