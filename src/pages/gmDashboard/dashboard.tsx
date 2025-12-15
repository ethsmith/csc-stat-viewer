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
import { PlayerTargets, PlayerRoles, PLAYER_ROLES } from "./types";
import {
	getPlayerTarget,
	getStatColor,
	getStatLabel,
	handleExportSettings,
	createImportHandler
} from "./utils";
import { generateInsights } from "./insightsEngine";
import { generateTeamSnapshot } from "./pdfExport";

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
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	const dashboardContentRef = React.useRef<HTMLDivElement>(null);
	
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
		setSelectedFranchise
	);

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleExport = () => {
		handleExportSettings(selectedFranchise, playerTargets, playerRoles, selectedStats);
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
				onExportSnapshot={() => {
					if (!dashboardContentRef.current || !selectedTeam || !currentFranchise) return;
					const players = selectedTeam.players || [];
					const totalMMR = players.reduce((acc, p) => acc + (p.mmr || 0), 0);
					generateTeamSnapshot(dashboardContentRef.current, {
						teamName: selectedTeam.name,
						tierName: selectedTeam.tier.name,
						franchiseName: currentFranchise.name,
						players: players.map(p => ({
							name: p.name,
							mmr: p.mmr || 0
						})),
						teamStats: {
							totalMMR,
							avgMMR: Math.round(totalMMR / players.length),
							mmrCap: selectedTeam.tier.mmrCap,
							mmrRemaining: selectedTeam.tier.mmrCap - totalMMR
						}
					});
				}}
				onChangeFranchise={handleClearFranchise}
				fileInputRef={fileInputRef}
				onFileChange={handleImportSettings}
			/>

			{/* Main Content */}
						<div className="flex-1 overflow-auto bg-gray-900">
				<div ref={dashboardContentRef} className="px-4 py-8 sm:px-6 lg:px-8">

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

							{/* Actionable Insights Panel */}
							<div className="mb-6">
								<InsightsPanel 
									insights={insights}
									players={selectedTeam.players?.map(p => p.name) || []}
								/>
							</div>

							{/* Team Summary */}
							<TeamSummary
								players={selectedTeam.players?.map(player => ({
									name: player.name,
									stats: getPlayerStats(player.name, selectedTeam.tier.name)
								})) || []}
								tierAverages={(() => {
									const tierStats = statsCache?.data?.[selectedTeam.tier.name as keyof typeof statsCache.data];
									if (!tierStats || tierStats.length === 0) return { rating: undefined, odaR: undefined };
									const avgRating = tierStats.reduce((sum, p) => sum + (p.rating || 0), 0) / tierStats.length;
									const avgOdaR = tierStats.reduce((sum, p) => sum + (p.odaR || 0), 0) / tierStats.length;
									return { rating: avgRating, odaR: avgOdaR };
								})()}
								playerTargets={parsedPlayerTargets}
								playerRoles={parsedPlayerRoles}
							/>

							<div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
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
												selectedTeam.players.map((player, index) => {
													const playerStats = getPlayerStats(player.name, selectedTeam.tier.name);
													return (
														<tr key={player.steam64Id || index} className="hover:bg-gray-750">
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

							{selectedTeam.players && selectedTeam.players.length > 0 && (
								<div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
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
							)}
						</div>
					)}
				</div>
			)}
				</div>
			</div>
		</div>
	);
}
