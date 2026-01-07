import * as React from "react";
import { Container } from "../../common/components/container";
import { Loading } from "../../common/components/loading";
import { useFetchFranchisesGraph } from "../../dao/franchisesGraphQLDao";
import { Franchise } from "../../models/franchise-types";
import { useLocalStorage } from "../../common/hooks/localStorage";
import { useStatsWithFallback } from "./hooks/useStatsWithFallback";
import { Link } from "wouter";
import { CscStats } from "../../models/csc-stats-types";
import { GMSidebar } from "./components/GMSidebar";
import { OffSeasonBanner } from "./components/OffSeasonBanner";
import { handleExportSettings, createImportHandler, parseColorblindColors, getPlayerTeamDisplay } from "./utils";
import { useCscPlayersCache } from "../../dao/cscPlayerGraphQLDao";
import { ALL_STATS } from "./types";

export function TableView() {
	const { data: franchises = [], isLoading } = useFetchFranchisesGraph();
	const [selectedFranchise, setSelectedFranchise] = useLocalStorage("franchise", "");
	const [selectedTier, setSelectedTier] = React.useState<string>("");
	const [comparePlayer, setComparePlayer] = React.useState<string>("");
	const [playerSearchQuery, setPlayerSearchQuery] = React.useState("");
	const [selectedPlayers, setSelectedPlayers] = React.useState<string[]>([]);
	const [showPlayerDropdown, setShowPlayerDropdown] = React.useState(false);
	const [sortColumn, setSortColumn] = React.useState<keyof CscStats | "name" | "team">("rating");
	const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");
	const [teamFilter, setTeamFilter] = React.useState<string>("");
	const [minGames, setMinGames] = React.useState<number>(0);
	const [showFilters, setShowFilters] = React.useState(false);
	const [statFilters, setStatFilters] = React.useState<Array<{ stat: keyof CscStats; operator: "<" | ">" | "<=" | ">=" | "="; value: number }>>([]);
	const [savedFilterPresets, setSavedFilterPresets] = useLocalStorage("tableViewFilterPresets", "[]");
	const [showSavePresetModal, setShowSavePresetModal] = React.useState(false);
	const [newPresetName, setNewPresetName] = React.useState("");
	const [colorblindMode, setColorblindMode] = useLocalStorage("colorblindMode", "false");
	const [colorblindColors, setColorblindColors] = useLocalStorage("colorblindColors", JSON.stringify({ good: "#22d3ee", warning: "#fb923c", bad: "#c084fc" }));
	const [playerTargets, setPlayerTargets] = useLocalStorage("playerTargets", "{}");
	const [playerRoles, setPlayerRoles] = useLocalStorage("playerRoles", "{}");
	const [selectedStats, setSelectedStats] = useLocalStorage("selectedTargetStats", '["rating"]');
	const [sectionOrder, setSectionOrder] = useLocalStorage("dashboardSectionOrder", "[]");
	const [hiddenSections, setHiddenSections] = useLocalStorage("dashboardHiddenSections", "[]");
	const [collapsedSections, setCollapsedSections] = useLocalStorage("dashboardCollapsedSections", "[]");
	const [scoutingNotes, setScoutingNotes] = useLocalStorage("scoutingNotes", "{}");
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const { 
		statsCache, 
		isLoading: isLoadingStats,
		isUsingFallback,
		effectiveSeason 
	} = useStatsWithFallback();

	const { data: playersData } = useCscPlayersCache(effectiveSeason);

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

	const comparePlayerStats = React.useMemo(() => {
		if (!comparePlayer || !tierPlayers.length) return null;
		return tierPlayers.find(p => p.name === comparePlayer) || null;
	}, [comparePlayer, tierPlayers]);

	const searchFilteredPlayers = React.useMemo(() => {
		if (!playerSearchQuery) return tierPlayers;
		const query = playerSearchQuery.toLowerCase();
		return tierPlayers.filter(p => p.name.toLowerCase().includes(query));
	}, [tierPlayers, playerSearchQuery]);

	const availableTeams = React.useMemo(() => {
		const teams = new Set<string>();
		tierPlayers.forEach(p => {
			const teamDisplay = getPlayerTeamDisplay(p.name, p.team, playersData);
			if (teamDisplay) teams.add(teamDisplay);
		});
		return Array.from(teams).sort();
	}, [tierPlayers, playersData]);

	const filteredPlayers = React.useMemo(() => {
		let players = tierPlayers;
		
		// Apply selected players filter
		if (selectedPlayers.length > 0) {
			players = players.filter(p => selectedPlayers.includes(p.name));
		}
		
		// Apply team filter
		if (teamFilter) {
			players = players.filter(p => getPlayerTeamDisplay(p.name, p.team, playersData) === teamFilter);
		}
		
		// Apply min games filter
		if (minGames > 0) {
			players = players.filter(p => (p.gameCount || 0) >= minGames);
		}
		
		// Apply stat filters
		statFilters.forEach(filter => {
			players = players.filter(p => {
				const val = p[filter.stat] as number | undefined;
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
		
		return players;
	}, [tierPlayers, selectedPlayers, teamFilter, minGames, statFilters]);

	const sortedPlayers = React.useMemo(() => {
		return [...filteredPlayers].sort((a, b) => {
			let aVal: string | number | undefined;
			let bVal: string | number | undefined;
			
			if (sortColumn === "name") {
				aVal = a.name.toLowerCase();
				bVal = b.name.toLowerCase();
			} else if (sortColumn === "team") {
				aVal = (a.team || "").toLowerCase();
				bVal = (b.team || "").toLowerCase();
			} else {
				aVal = a[sortColumn] as number | undefined;
				bVal = b[sortColumn] as number | undefined;
			}
			
			// Handle undefined values - push them to the end
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

	const handleSort = (column: keyof CscStats | "name" | "team") => {
		if (sortColumn === column) {
			setSortDirection(prev => prev === "asc" ? "desc" : "asc");
		} else {
			setSortColumn(column);
			// Default to descending for numeric stats, ascending for name/team
			setSortDirection(column === "name" || column === "team" ? "asc" : "desc");
		}
	};

	const getSortIndicator = (column: keyof CscStats | "name" | "team") => {
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

	type FilterPreset = {
		name: string;
		teamFilter: string;
		minGames: number;
		statFilters: Array<{ stat: keyof CscStats; operator: "<" | ">" | "<=" | ">=" | "="; value: number }>;
		sortColumn: keyof CscStats | "name" | "team";
		sortDirection: "asc" | "desc";
	};

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
			statFilters,
			sortColumn,
			sortDirection,
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
		setStatFilters(preset.statFilters);
		setSortColumn(preset.sortColumn);
		setSortDirection(preset.sortDirection);
	};

	const deletePreset = (presetName: string) => {
		const updatedPresets = parsedPresets.filter(p => p.name !== presetName);
		setSavedFilterPresets(JSON.stringify(updatedPresets));
	};

	const getComparisonColor = (
		value: number | undefined, 
		compareValue: number | undefined, 
		statKey: keyof CscStats
	): { className: string; style?: React.CSSProperties } => {
		if (value === undefined || compareValue === undefined) {
			return { className: "text-gray-400" };
		}

		const isColorblind = colorblindMode === "true";
		const colors = parseColorblindColors(colorblindColors);

		const lowerIsBetter = ["deaths", "adp"].includes(statKey);
		
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

		if (isColorblind) {
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

	const handleExport = () => {
		handleExportSettings(selectedFranchise, playerTargets, playerRoles, selectedStats, sectionOrder, hiddenSections, collapsedSections, scoutingNotes, colorblindMode, colorblindColors);
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
		setColorblindColors
	);

	if (isLoading || isLoadingStats) {
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
				currentPage="tableview"
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
					<h1 className="text-2xl font-bold text-white mb-4">Table View - All Players Comparison</h1>
					
					<div className="flex flex-wrap gap-4 items-end">
						<div>
							<label className="block text-sm text-gray-400 mb-1">Select Tier</label>
							<select
								value={selectedTier}
								onChange={(e) => {
									setSelectedTier(e.target.value);
									setComparePlayer("");
								}}
								className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
							>
								{availableTiers.map(tier => (
									<option key={tier} value={tier}>{tier}</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-sm text-gray-400 mb-1">Compare To Player</label>
							<select
								value={comparePlayer}
								onChange={(e) => setComparePlayer(e.target.value)}
								className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 min-w-[200px]"
							>
								<option value="">Select a player to compare...</option>
								{tierPlayers
									.sort((a, b) => (b.rating || 0) - (a.rating || 0))
									.map(player => (
										<option key={player.name} value={player.name}>
											{player.name} ({player.rating?.toFixed(2) || "N/A"})
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
											.sort((a, b) => (b.rating || 0) - (a.rating || 0))
											.slice(0, 20)
											.map(player => (
												<button
													key={player.name}
													onClick={() => {
														togglePlayerSelection(player.name);
													}}
													className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center justify-between ${
														selectedPlayers.includes(player.name) ? "bg-blue-900/30" : ""
													}`}
												>
													<span className="text-white">{player.name}</span>
													<span className="text-gray-400 text-xs">
														{player.rating?.toFixed(2)}
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

					{showFilters && (
						<div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
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
											onChange={(e) => setSortColumn(e.target.value as keyof CscStats | "name" | "team")}
											className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 min-w-[150px]"
										>
											<option value="name">Player Name</option>
											<option value="team">Team</option>
											{ALL_STATS.map(stat => (
												<option key={stat.key} value={stat.key}>{stat.label}</option>
											))}
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

							{/* Saved Presets Section */}
							<div className="mt-4 pt-4 border-t border-gray-600">
								<div className="flex items-center justify-between mb-3">
									<h4 className="text-sm font-medium text-white">Saved Presets</h4>
									<button
										onClick={() => setShowSavePresetModal(true)}
										className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
									>
										+ Save Current
									</button>
								</div>
								{parsedPresets.length === 0 ? (
									<p className="text-gray-500 text-sm">No saved presets. Click "Save Current" to save your current filters and sorting.</p>
								) : (
									<div className="flex flex-wrap gap-2">
										{parsedPresets.map(preset => (
											<div key={preset.name} className="inline-flex items-center gap-1 bg-gray-700 rounded-lg overflow-hidden">
												<button
													onClick={() => loadPreset(preset)}
													className="px-3 py-1.5 text-white text-sm hover:bg-gray-600 transition-colors"
													title={`Load preset: ${preset.name}`}
												>
													{preset.name}
												</button>
												<button
													onClick={() => deletePreset(preset.name)}
													className="px-2 py-1.5 text-red-400 hover:bg-red-600 hover:text-white text-sm transition-colors"
													title="Delete preset"
												>
													×
												</button>
											</div>
										))}
									</div>
								)}
							</div>

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
										<div className="text-sm text-gray-400 mb-4">
											<p className="mb-1">This will save:</p>
											<ul className="list-disc list-inside text-xs">
												<li>Team filter: {teamFilter || "None"}</li>
												<li>Min games: {minGames}</li>
												<li>Stat filters: {statFilters.length}</li>
												<li>Sort: {sortColumn} ({sortDirection})</li>
											</ul>
										</div>
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
							{/* Stat Filters Section */}
							<div className="mt-4 pt-4 border-t border-gray-600">
								<div className="flex items-center justify-between mb-3">
									<h4 className="text-sm font-medium text-white">Stat Filters</h4>
									<button
										onClick={() => setStatFilters([...statFilters, { stat: "rating", operator: ">=", value: 0 }])}
										className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
									>
										+ Add Filter
									</button>
								</div>
								{statFilters.length === 0 ? (
									<p className="text-gray-500 text-sm">No stat filters applied. Click "Add Filter" to filter by stat values.</p>
								) : (
									<div className="space-y-2">
										{statFilters.map((filter, index) => (
											<div key={index} className="flex items-center gap-2 flex-wrap">
												<select
													value={filter.stat}
													onChange={(e) => {
														const newFilters = [...statFilters];
														newFilters[index] = { ...filter, stat: e.target.value as keyof CscStats };
														setStatFilters(newFilters);
													}}
													className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
												>
													{ALL_STATS.map(stat => (
														<option key={stat.key} value={stat.key}>{stat.label}</option>
													))}
												</select>
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

					{selectedPlayers.length > 0 && (
						<div className="mt-3 flex flex-wrap gap-2">
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

					{comparePlayer && comparePlayerStats && (
						<div className="mt-4 p-3 bg-blue-900/30 border border-blue-600 rounded-lg">
							<span className="text-blue-200 text-sm">
								Comparing all players to: <strong>{comparePlayer}</strong> (Rating: {comparePlayerStats.rating?.toFixed(2)})
							</span>
						</div>
					)}
				</div>

				<div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
					<h3 className="text-sm font-bold text-white mb-2">Color Legend</h3>
					<div className="flex gap-6 text-sm">
						<div className="flex items-center gap-2">
							<div 
								className={`w-4 h-4 rounded ${colorblindMode !== "true" ? "bg-green-400" : ""}`}
								style={colorblindMode === "true" ? { backgroundColor: parseColorblindColors(colorblindColors).good } : {}}
							></div>
							<span className="text-gray-300">Higher than compared player</span>
						</div>
						<div className="flex items-center gap-2">
							<div 
								className={`w-4 h-4 rounded ${colorblindMode !== "true" ? "bg-blue-400" : ""}`}
								style={colorblindMode === "true" ? { backgroundColor: parseColorblindColors(colorblindColors).atTarget } : {}}
							></div>
							<span className="text-gray-300">Same as compared player</span>
						</div>
						<div className="flex items-center gap-2">
							<div 
								className={`w-4 h-4 rounded ${colorblindMode !== "true" ? "bg-red-400" : ""}`}
								style={colorblindMode === "true" ? { backgroundColor: parseColorblindColors(colorblindColors).bad } : {}}
							></div>
							<span className="text-gray-300">Lower than compared player</span>
						</div>
					</div>
				</div>

				<div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
					<div className="overflow-auto max-h-[calc(100vh-350px)]">
						<table className="w-full text-sm border-separate border-spacing-0">
							<thead className="bg-gray-900">
								<tr>
									<th 
										className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sticky left-0 top-0 bg-gray-900 z-40 min-w-[150px] cursor-pointer hover:text-white transition-colors select-none"
										onClick={() => handleSort("name")}
									>
										Player{getSortIndicator("name")}
									</th>
									<th 
										className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[80px] cursor-pointer hover:text-white transition-colors select-none bg-gray-900 sticky top-0 z-20"
										onClick={() => handleSort("team")}
									>
										Team{getSortIndicator("team")}
									</th>
									{ALL_STATS.map(stat => (
										<th 
											key={stat.key} 
											className="px-2 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[60px] cursor-pointer hover:text-white transition-colors select-none bg-gray-900 sticky top-0 z-20"
											title={stat.description}
											onClick={() => handleSort(stat.key)}
										>
											{stat.label}{getSortIndicator(stat.key)}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-700">
								{sortedPlayers.length > 0 ? (
									sortedPlayers.map((player, index) => {
											const isComparePlayer = player.name === comparePlayer;
											return (
												<tr 
													key={player.name} 
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
														{getPlayerTeamDisplay(player.name, player.team, playersData)}
													</td>
													{ALL_STATS.map(stat => {
														const value = player[stat.key] as number | undefined;
														const compareValue = comparePlayerStats?.[stat.key] as number | undefined;
														const colorInfo = comparePlayer && !isComparePlayer
															? getComparisonColor(value, compareValue, stat.key)
															: { className: "text-gray-300" };
														
														return (
															<td 
																key={stat.key} 
																className={`px-2 py-2 text-center whitespace-nowrap ${colorInfo.className}`}
																style={colorInfo.style}
															>
																{value !== undefined ? (
																	typeof value === "number" && !Number.isInteger(value) 
																		? value.toFixed(2) 
																		: value
																) : "-"}
															</td>
														);
													})}
												</tr>
											);
										})
								) : (
									<tr>
										<td colSpan={ALL_STATS.length + 2} className="px-6 py-8 text-center text-gray-400">
											No players found in this tier
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>

				<div className="mt-4 text-sm text-gray-500">
					Showing {sortedPlayers.length} of {tierPlayers.length} players in {selectedTier}
					{(teamFilter || minGames > 0 || statFilters.length > 0) && (
						<span className="ml-2">
							(Filtered{teamFilter && ` by ${teamFilter}`}{minGames > 0 && ` with ≥${minGames} games`}{statFilters.length > 0 && ` with ${statFilters.length} stat filter${statFilters.length > 1 ? "s" : ""}`})
						</span>
					)}
				</div>
			</div>
		</div>
	);
}
