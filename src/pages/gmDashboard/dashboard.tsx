import * as React from "react";
import { Container } from "../../common/components/container";
import { Loading } from "../../common/components/loading";
import { useFetchFranchisesGraph } from "../../dao/franchisesGraphQLDao";
import { Franchise } from "../../models/franchise-types";
import { useLocalStorage } from "../../common/hooks/localStorage";
import { useCscStatsCache } from "../../dao/cscStatsGraphQLDao";
import { useCachedCscSeasonAndTiers } from "../../dao/cscSeasonAndTiersDao";
import { Link } from "wouter";
import { franchiseImages } from "../../common/images/franchise";
import { CscStats } from "../../models/csc-stats-types";
import { GMSidebar } from "./components/GMSidebar";
import { InsightsPanel, Insight } from "./components/InsightsPanel";
import { PlayerStatCell } from "./components/PlayerStatCell";
import { TeamSummary } from "./components/TeamSummary";
import { RoleFitScore } from "./components/RoleFitScore";
import { DraggableSection, SectionId, DEFAULT_SECTION_ORDER, SECTION_LABELS } from "./components/DraggableSection";
import { PlayerTargets, PlayerRoles, PLAYER_ROLES } from "./types";
import {
	getPlayerTarget,
	getStatColor,
	getStatLabel,
	handleExportSettings,
	createImportHandler
} from "./utils";
import { generateInsights } from "./insightsEngine";

const getFranchiseImage = (prefix: string): string => {
	return franchiseImages[prefix] || "";
};

export function Dashboard() {
	const { data: franchises = [], isLoading } = useFetchFranchisesGraph();
	const [selectedFranchise, setSelectedFranchise] = useLocalStorage("franchise", "");
	const [searchQuery, setSearchQuery] = React.useState("");
	const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);
	const [playerTargets, setPlayerTargets] = useLocalStorage("playerTargets", "{}");
	const [selectedStats, setSelectedStats] = useLocalStorage("selectedTargetStats", '["rating"]');
	const [playerRoles, setPlayerRoles] = useLocalStorage("playerRoles", "{}");
	const [sectionOrder, setSectionOrder] = useLocalStorage("dashboardSectionOrder", JSON.stringify(DEFAULT_SECTION_ORDER));
	const [hiddenSections, setHiddenSections] = useLocalStorage("dashboardHiddenSections", "[]");
	const [collapsedSections, setCollapsedSections] = useLocalStorage("dashboardCollapsedSections", "[]");
	const [showHiddenMenu, setShowHiddenMenu] = React.useState(false);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const parsedSectionOrder: SectionId[] = React.useMemo(() => {
		try {
			const parsed = JSON.parse(sectionOrder);
			if (Array.isArray(parsed) && parsed.length === DEFAULT_SECTION_ORDER.length) {
				return parsed as SectionId[];
			}
			return DEFAULT_SECTION_ORDER;
		} catch {
			return DEFAULT_SECTION_ORDER;
		}
	}, [sectionOrder]);

	const parsedHiddenSections: SectionId[] = React.useMemo(() => {
		try {
			const parsed = JSON.parse(hiddenSections);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}, [hiddenSections]);

	const parsedCollapsedSections: SectionId[] = React.useMemo(() => {
		try {
			const parsed = JSON.parse(collapsedSections);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}, [collapsedSections]);

	const hideSection = (sectionId: SectionId) => {
		const newHidden = [...parsedHiddenSections, sectionId];
		setHiddenSections(JSON.stringify(newHidden));
	};

	const showSection = (sectionId: SectionId) => {
		const newHidden = parsedHiddenSections.filter(id => id !== sectionId);
		setHiddenSections(JSON.stringify(newHidden));
	};

	const toggleSectionCollapse = (sectionId: SectionId, expanded: boolean) => {
		if (expanded) {
			// Remove from collapsed list
			const newCollapsed = parsedCollapsedSections.filter(id => id !== sectionId);
			setCollapsedSections(JSON.stringify(newCollapsed));
		} else {
			// Add to collapsed list
			const newCollapsed = [...parsedCollapsedSections, sectionId];
			setCollapsedSections(JSON.stringify(newCollapsed));
		}
	};

	const isSectionExpanded = (sectionId: SectionId) => !parsedCollapsedSections.includes(sectionId);

	const visibleSections = parsedSectionOrder.filter(id => !parsedHiddenSections.includes(id));

	const [dragIndex, setDragIndex] = React.useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

	const handleDragStart = (index: number) => {
		setDragIndex(index);
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		if (dragIndex !== null && dragIndex !== index) {
			setDragOverIndex(index);
		}
	};

	const handleDragEnd = () => {
		setDragIndex(null);
		setDragOverIndex(null);
	};

	const handleDrop = (e: React.DragEvent, toIndex: number) => {
		e.preventDefault();
		if (dragIndex === null || dragIndex === toIndex) {
			handleDragEnd();
			return;
		}

		const newOrder = [...parsedSectionOrder];
		const [removed] = newOrder.splice(dragIndex, 1);
		newOrder.splice(toIndex, 0, removed);
		setSectionOrder(JSON.stringify(newOrder));
		handleDragEnd();
	};
	
	const { data: seasonAndTierConfig } = useCachedCscSeasonAndTiers();
	const season = seasonAndTierConfig?.number ?? 0;
	const matchType = seasonAndTierConfig?.hasSeasonStarted ? "Regulation" : "Combine";
	
	const { data: statsCache, isLoading: isLoadingStats } = useCscStatsCache(
		season,
		matchType,
		{ enabled: season > 0 }
	);

	const filteredFranchises = React.useMemo(() => {
		if (!searchQuery) return franchises;
		const query = searchQuery.toLowerCase();
		return franchises.filter(
			franchise =>
				franchise.name.toLowerCase().includes(query) ||
				franchise.prefix.toLowerCase().includes(query)
		);
	}, [franchises, searchQuery]);

	const handleFranchiseSelect = (franchise: Franchise) => {
		setSelectedFranchise(franchise.prefix);
	};

	const handleClearFranchise = () => {
		setSelectedFranchise("");
	};

	const handleImportSettings = createImportHandler(
		setPlayerTargets,
		setPlayerRoles,
		setSelectedStats,
		setSelectedFranchise,
		setSectionOrder,
		setHiddenSections,
		setCollapsedSections
	);

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleExport = () => {
		handleExportSettings(selectedFranchise, playerTargets, playerRoles, selectedStats, sectionOrder, hiddenSections, collapsedSections);
	};

	const currentFranchise = franchises.find(f => f.prefix === selectedFranchise);

	React.useEffect(() => {
		if (currentFranchise?.teams && currentFranchise.teams.length > 0 && !selectedTeamId) {
			setSelectedTeamId(currentFranchise.teams[0].id);
		}
	}, [currentFranchise, selectedTeamId]);

	const selectedTeam = currentFranchise?.teams?.find(team => team.id === selectedTeamId);
	
	const getPlayerStats = (playerName: string, tierName: string) => {
		const tierStats = statsCache?.data?.[tierName as keyof typeof statsCache.data];
		return tierStats?.find(stat => stat.name === playerName);
	};

	const parsedPlayerTargets: PlayerTargets = React.useMemo(() => {
		try {
			return JSON.parse(playerTargets);
		} catch {
			return {};
		}
	}, [playerTargets]);

	const parsedSelectedStats: string[] = React.useMemo(() => {
		try {
			const parsed = JSON.parse(selectedStats);
			return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["rating"];
		} catch {
			return ["rating"];
		}
	}, [selectedStats]);

	const parsedPlayerRoles: PlayerRoles = React.useMemo(() => {
		try {
			return JSON.parse(playerRoles);
		} catch {
			return {};
		}
	}, [playerRoles]);

	// Generate insights for the selected team
	const insights: Insight[] = React.useMemo(() => {
		if (!selectedTeam || !selectedTeam.players || !statsCache) return [];

		const teamData = {
			players: selectedTeam.players.map(player => {
				const playerStats = getPlayerStats(player.name, selectedTeam.tier.name);
				const target: Record<string, number> = {};
				
				parsedSelectedStats.forEach(statKey => {
					const targetValue = getPlayerTarget(
						parsedPlayerTargets,
						statsCache,
						player.name,
						statKey,
						selectedTeam.tier.name
					);
					if (targetValue !== undefined) {
						target[statKey] = targetValue;
					}
				});

				return {
					name: player.name,
					stats: playerStats || ({} as CscStats),
					role: parsedPlayerRoles[player.name],
					target
				};
			}),
			tierName: selectedTeam.tier.name
		};

		return generateInsights(teamData, parsedPlayerTargets, parsedPlayerRoles, parsedSelectedStats);
	}, [selectedTeam, statsCache, parsedPlayerTargets, parsedPlayerRoles, parsedSelectedStats]);

	if (isLoading || isLoadingStats) {
		return (
			<Container>
				<Loading />
			</Container>
		);
	}

	if (!selectedFranchise) {
		return (
			<Container>
				<div className="mx-auto max-w-2xl text-center mb-8">
					<h2 className="text-3xl font-bold sm:text-4xl">Select Your Franchise</h2>
					<p className="mt-4 text-gray-300">
						Please select the franchise you represent to access the dashboard.
					</p>
					<div className="mt-6 flex justify-center">
						<button
							onClick={handleImportClick}
							className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center gap-2 text-lg font-semibold"
							title="Import targets and settings"
						>
							<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
								<path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
							</svg>
							Import Settings
						</button>
						<input
							ref={fileInputRef}
							type="file"
							accept=".json"
							onChange={handleImportSettings}
							className="hidden"
						/>
					</div>
				</div>

				<div className="mx-auto max-w-xl mb-8">
					<div className="relative">
						<input
							type="text"
							placeholder="Search franchises by name or prefix..."
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery("")}
								className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
							>
								✕
							</button>
						)}
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredFranchises.map(franchise => (
						<button
							key={franchise.prefix}
							onClick={() => handleFranchiseSelect(franchise)}
							className="p-6 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 hover:bg-gray-750 transition-all duration-200 text-left group"
						>
							<div className="flex items-center gap-4">
								<img
									src={getFranchiseImage(franchise.prefix)}
									alt={franchise.name}
									className="w-16 h-16 object-contain"
									onError={(e) => {
										(e.target as HTMLImageElement).style.display = 'none';
									}}
								/>
								<div className="flex-1">
									<h3 className="text-xl font-bold group-hover:text-blue-400 transition-colors">
										{franchise.name}
									</h3>
									<p className="text-gray-400 text-sm">{franchise.prefix}</p>
									{franchise.gm && (
										<p className="text-gray-500 text-xs mt-1">GM: {franchise.gm.name}</p>
									)}
								</div>
							</div>
							<div className="mt-4 text-sm text-gray-400">
								{franchise.teams?.length || 0} team{franchise.teams?.length !== 1 ? 's' : ''}
							</div>
						</button>
					))}
				</div>

				{filteredFranchises.length === 0 && (
					<div className="text-center text-gray-400 mt-8">
						<p>No franchises found matching "{searchQuery}"</p>
					</div>
				)}
			</Container>
		);
	}

	return (
				<div className="flex bg-gray-900">
			<GMSidebar
				currentFranchise={currentFranchise}
				currentPage="dashboard"
				onExport={handleExport}
				onImport={handleImportClick}
				onChangeFranchise={handleClearFranchise}
				fileInputRef={fileInputRef}
				onFileChange={handleImportSettings}
			/>

			{/* Main Content */}
						<div className="flex-1 overflow-hidden">
				<div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

			{currentFranchise && currentFranchise.teams && currentFranchise.teams.length > 0 && (
				<div className="mt-8">
					<div className="border-b border-gray-700 mb-6">
						<div className="flex gap-2 overflow-x-auto">
							{currentFranchise.teams.map(team => (
								<button
									key={team.id}
									onClick={() => setSelectedTeamId(team.id)}
									className={`px-6 py-3 font-semibold whitespace-nowrap transition-colors border-b-2 ${
										selectedTeamId === team.id
											? "border-blue-500 text-blue-400"
											: "border-transparent text-gray-400 hover:text-gray-200"
									}`}
								>
									{team.name}
									<span className="ml-2 text-xs px-2 py-1 rounded bg-gray-700">
										{team.tier.name}
									</span>
								</button>
							))}
						</div>
					</div>

					{selectedTeam && (
						<div>
							<div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<p className="text-sm text-gray-400">Tier</p>
										<p className="text-lg font-bold">{selectedTeam.tier.name}</p>
									</div>
									<div>
										<p className="text-sm text-gray-400">MMR Cap</p>
										<p className="text-lg font-bold">{selectedTeam.tier.mmrCap}</p>
									</div>
									<div>
										<p className="text-sm text-gray-400">Total Players</p>
										<p className="text-lg font-bold">{selectedTeam.players?.length || 0}</p>
									</div>
								</div>
							</div>

							{/* Hidden Sections Restore Button */}
							{parsedHiddenSections.length > 0 && (
								<div className="mb-4 flex justify-end relative">
									<button
										onClick={() => setShowHiddenMenu(!showHiddenMenu)}
										className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors flex items-center gap-2 text-sm"
									>
										<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
											<path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
											<path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
										</svg>
										Show Hidden ({parsedHiddenSections.length})
									</button>
									{showHiddenMenu && (
										<div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-30 min-w-[200px]">
											<div className="p-2">
												<p className="text-xs text-gray-400 px-2 py-1 mb-1">Hidden Sections</p>
												{parsedHiddenSections.map(sectionId => (
													<button
														key={sectionId}
														onClick={() => {
															showSection(sectionId);
															if (parsedHiddenSections.length === 1) {
																setShowHiddenMenu(false);
															}
														}}
														className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 rounded flex items-center gap-2"
													>
														<svg className="h-4 w-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
															<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
														</svg>
														{SECTION_LABELS[sectionId]}
													</button>
												))}
											</div>
										</div>
									)}
								</div>
							)}

							{/* Reorderable Sections */}
							<div className="space-y-0">
								{visibleSections.map((sectionId, index) => {
									const tierAverages = (() => {
										const tierStats = statsCache?.data?.[selectedTeam.tier.name as keyof typeof statsCache.data];
										if (!tierStats || tierStats.length === 0) return { rating: undefined, odaR: undefined, impact: undefined };
										const avgRating = tierStats.reduce((sum, p) => sum + (p.rating || 0), 0) / tierStats.length;
										const avgOdaR = tierStats.reduce((sum, p) => sum + (p.odaR || 0), 0) / tierStats.length;
										const avgImpact = tierStats.reduce((sum, p) => sum + (p.impact || 0), 0) / tierStats.length;
										return { rating: avgRating, odaR: avgOdaR, impact: avgImpact };
									})();

									const renderSection = () => {
										switch (sectionId) {
											case "insights":
												return (
													<div className="mb-6">
														<InsightsPanel 
															insights={insights}
															players={selectedTeam.players?.map(p => p.name) || []}
															onHide={() => hideSection("insights")}
															isExpanded={isSectionExpanded("insights")}
															onToggleExpand={(expanded) => toggleSectionCollapse("insights", expanded)}
														/>
													</div>
												);
											case "teamSummary":
												return (
													<TeamSummary
														players={selectedTeam.players?.map(player => ({
															name: player.name,
															stats: getPlayerStats(player.name, selectedTeam.tier.name)
														})) || []}
														tierAverages={tierAverages}
														playerTargets={parsedPlayerTargets}
														playerRoles={parsedPlayerRoles}
														onHide={() => hideSection("teamSummary")}
														isExpanded={isSectionExpanded("teamSummary")}
														onToggleExpand={(expanded) => toggleSectionCollapse("teamSummary", expanded)}
													/>
												);
											case "roleFitScore":
												return (
													<RoleFitScore
														players={selectedTeam.players?.map(player => ({
															name: player.name,
															stats: getPlayerStats(player.name, selectedTeam.tier.name)
														})) || []}
														playerRoles={parsedPlayerRoles}
														tierAverages={tierAverages}
														onHide={() => hideSection("roleFitScore")}
														isExpanded={isSectionExpanded("roleFitScore")}
														onToggleExpand={(expanded) => toggleSectionCollapse("roleFitScore", expanded)}
													/>
												);
											case "playerTable":
												return (
													<div className="mb-6 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden relative group">
														<button
															onClick={() => hideSection("playerTable")}
															className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 px-2 py-1 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded"
															title="Hide section"
														>
															<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
																<path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
																<path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
															</svg>
														</button>
														<div className="overflow-x-auto">
															<table className="w-full">
																<thead className="bg-gray-900">
																	<tr>
																		<th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																			Player
																		</th>
																		<th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																			MMR
																		</th>
																		{parsedSelectedStats.map(statKey => (
																			<th key={statKey} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																				{getStatLabel(statKey)}
																			</th>
																		))}
																		<th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																			Role
																		</th>
																	</tr>
																</thead>
																<tbody className="divide-y divide-gray-700">
																	{selectedTeam.players && selectedTeam.players.length > 0 ? (
																		selectedTeam.players.map((player, idx) => {
																			const playerStats = getPlayerStats(player.name, selectedTeam.tier.name);
																			return (
																				<tr key={player.steam64Id || idx} className="hover:bg-gray-750">
																					<td className="px-6 py-4 whitespace-nowrap">
																						<Link href={`/players/${player.name}`}>
																							<div className="text-sm font-medium text-white hover:text-blue-400 cursor-pointer transition-colors">
																								{player.name}
																							</div>
																						</Link>
																					</td>
																					<td className="px-6 py-4 whitespace-nowrap">
																						<div className="text-sm text-gray-300">{player.mmr}</div>
																					</td>
																					{parsedSelectedStats.map(statKey => {
																						const playerStat = getPlayerStats(player.name, selectedTeam.tier.name);
																						const currentValue = playerStat?.[statKey as keyof CscStats] as number | undefined;
																						const targetValue = getPlayerTarget(parsedPlayerTargets, statsCache, player.name, statKey, selectedTeam.tier.name);
																						const statColor = getStatColor(currentValue, targetValue, statKey);
																						
																						return (
																							<PlayerStatCell
																								key={`${player.name}-${statKey}`}
																								playerName={player.name}
																								playerSteam64Id={player.steam64Id}
																								statKey={statKey}
																								currentValue={currentValue}
																								statColor={statColor}
																								season={season}
																							/>
																						);
																					})}
																					<td className="px-6 py-4 whitespace-nowrap">
																						<div className="flex items-center gap-2">
																							{parsedPlayerRoles[player.name] && (
																								<span className="px-2 py-1 text-xs rounded bg-gray-700 text-white">
																									{parsedPlayerRoles[player.name]}
																								</span>
																							)}
																							{selectedTeam.captain?.steam64Id === player.steam64Id && (
																								<span className="px-2 py-1 text-xs rounded bg-yellow-600 text-white">
																									Captain
																								</span>
																							)}
																						</div>
																					</td>
																				</tr>
																			);
																		})
																	) : (
																		<tr>
																			<td colSpan={parsedSelectedStats.length + 3} className="px-6 py-8 text-center text-gray-400">
																				No players on this team
																			</td>
																		</tr>
																	)}
																</tbody>
															</table>
														</div>
													</div>
												);
											case "mmrSummary":
												if (!selectedTeam.players || selectedTeam.players.length === 0) return null;
												return (
													<div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700 relative group">
														<button
															onClick={() => hideSection("mmrSummary")}
															className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 px-2 py-1 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded"
															title="Hide section"
														>
															<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
																<path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
																<path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
															</svg>
														</button>
														<div className="flex justify-between items-center">
															<div>
																<p className="text-sm text-gray-400">Total Team MMR</p>
																<p className="text-2xl font-bold text-blue-400">
																	{selectedTeam.players.reduce((acc, player) => acc + (player.mmr || 0), 0)}
																</p>
															</div>
															<div>
																<p className="text-sm text-gray-400">Average MMR</p>
																<p className="text-2xl font-bold text-green-400">
																	{Math.round(
																		selectedTeam.players.reduce((acc, player) => acc + (player.mmr || 0), 0) /
																			selectedTeam.players.length
																	)}
																</p>
															</div>
															<div>
																<p className="text-sm text-gray-400">MMR Remaining</p>
																<p className="text-2xl font-bold text-purple-400">
																	{selectedTeam.tier.mmrCap -
																		selectedTeam.players.reduce((acc, player) => acc + (player.mmr || 0), 0)}
																</p>
															</div>
														</div>
													</div>
												);
											default:
												return null;
										}
									};

									return (
										<DraggableSection
											key={sectionId}
											id={sectionId}
											index={index}
											isDragging={dragIndex === index}
											dragOverIndex={dragOverIndex}
											onDragStart={handleDragStart}
											onDragOver={handleDragOver}
											onDragEnd={handleDragEnd}
											onDrop={handleDrop}
										>
											{renderSection()}
										</DraggableSection>
									);
								})}
							</div>
						</div>
					)}
				</div>
			)}
				</div>
			</div>
		</div>
	);
}
