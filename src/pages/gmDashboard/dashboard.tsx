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

type PlayerTargets = Record<string, Record<string, number>>;
type PlayerRoles = Record<string, string>;
type PlayerRole = "IGL" | "AWPER" | "ENTRY" | "SUPPORT" | "RIFLER" | "LURKER";

const AVAILABLE_STATS: { key: keyof CscStats; label: string }[] = [
	{ key: "rating", label: "Rating" },
	{ key: "kr", label: "K/R" },
	{ key: "adr", label: "ADR" },
	{ key: "kast", label: "KAST" },
	{ key: "impact", label: "Impact" },
	{ key: "hs", label: "HS%" },
	{ key: "clutchR", label: "Clutch" },
	{ key: "awpR", label: "AWP K/R" },
	{ key: "odr", label: "OD%" },
	{ key: "odaR", label: "ODA/R" },
];

const PLAYER_ROLES: PlayerRole[] = ["IGL", "AWPER", "ENTRY", "SUPPORT", "RIFLER", "LURKER"];

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

	const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				const importData = JSON.parse(content);

				if (importData.franchise) {
					setSelectedFranchise(importData.franchise);
				}
				if (importData.playerTargets) {
					setPlayerTargets(importData.playerTargets);
				}
				if (importData.playerRoles) {
					setPlayerRoles(importData.playerRoles);
				}
				if (importData.selectedTargetStats) {
					setSelectedStats(importData.selectedTargetStats);
				}

				alert('Settings imported successfully!');
			} catch (error) {
				alert('Error importing settings. Please check the file format.');
				console.error('Import error:', error);
			}
		};
		reader.readAsText(file);

		if (event.target) {
			event.target.value = '';
		}
	};

	const handleImportClick = () => {
		fileInputRef.current?.click();
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

	const getTierAverage = (tierName: string, statKey: string): number | undefined => {
		const tierStats = statsCache?.data?.[tierName as keyof typeof statsCache.data];
		if (!tierStats || tierStats.length === 0) return undefined;
		
		const validValues = tierStats
			.map(stat => stat[statKey as keyof CscStats] as number | undefined)
			.filter((val): val is number => val !== undefined && !isNaN(val));
		
		if (validValues.length === 0) return undefined;
		
		const sum = validValues.reduce((acc, val) => acc + val, 0);
		return sum / validValues.length;
	};

	const getPlayerTarget = (playerName: string, statKey: string, tierName: string): number | undefined => {
		const playerTargetData = parsedPlayerTargets[playerName];
		if (playerTargetData && playerTargetData[statKey] !== undefined) {
			return playerTargetData[statKey];
		}
		return getTierAverage(tierName, statKey);
	};

	const getStatColor = (currentValue: number | undefined, targetValue: number | undefined, statKey: string) => {
		if (!currentValue || !targetValue) return "text-gray-300";
		const diff = currentValue - targetValue;
		const threshold = statKey === "rating" ? 0.03 : targetValue * 0.05;
		if (diff > threshold) return "text-green-400";
		if (diff >= 0) return "text-blue-400";
		if (diff >= -threshold) return "text-yellow-400";
		return "text-red-400";
	};

	const getStatLabel = (statKey: string): string => {
		const stat = AVAILABLE_STATS.find(s => s.key === statKey);
		return stat?.label || statKey;
	};

	const handleExportSettings = () => {
		const exportData = {
			franchise: selectedFranchise,
			playerTargets: playerTargets,
			playerRoles: playerRoles,
			selectedTargetStats: selectedStats,
			exportDate: new Date().toISOString(),
			version: "1.0"
		};

		const dataStr = JSON.stringify(exportData, null, 2);
		const dataBlob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(dataBlob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `gm-targets-${selectedFranchise}-${new Date().toISOString().split('T')[0]}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

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
		<Container>
			<div className="flex justify-between items-center mb-8">
				<div className="flex items-center gap-6">
					{currentFranchise && (
						<img
							src={getFranchiseImage(currentFranchise.prefix)}
							alt={currentFranchise.name}
							className="w-20 h-20 object-contain"
							onError={(e) => {
								(e.target as HTMLImageElement).style.display = 'none';
							}}
						/>
					)}
					<div>
						<h2 className="text-3xl font-bold">Franchise Dashboard</h2>
						{currentFranchise && (
							<p className="mt-2 text-gray-300">
								Managing: <span className="font-semibold text-blue-400">{currentFranchise.name}</span>
							</p>
						)}
					</div>
				</div>
				<div className="flex gap-3">
					<button
						onClick={handleExportSettings}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
						title="Export targets and settings"
					>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
						</svg>
						Export
					</button>
					<button
						onClick={handleImportClick}
						className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center gap-2"
						title="Import targets and settings"
					>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
						</svg>
						Import
					</button>
					<Link href="/dashboard/targets">
						<button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
							Set Targets
						</button>
					</Link>
					<button
						onClick={handleClearFranchise}
						className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
					>
						Change Franchise
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
				<div className="p-6 bg-gray-800 rounded-lg border border-gray-700">
					<h3 className="text-xl font-bold mb-2">Teams</h3>
					<p className="text-3xl font-bold text-blue-400">{currentFranchise?.teams?.length || 0}</p>
				</div>

				<div className="p-6 bg-gray-800 rounded-lg border border-gray-700">
					<h3 className="text-xl font-bold mb-2">Total Players</h3>
					<p className="text-3xl font-bold text-green-400">
						{currentFranchise?.teams?.reduce((acc, team) => acc + (team.players?.length || 0), 0) || 0}
					</p>
				</div>

				<div className="p-6 bg-gray-800 rounded-lg border border-gray-700">
					<h3 className="text-xl font-bold mb-2">General Manager</h3>
					<p className="text-lg text-gray-300">{currentFranchise?.gm?.name || "N/A"}</p>
					{currentFranchise?.agms && currentFranchise.agms.length > 0 && (
						<div className="mt-3">
							<p className="text-sm text-gray-400 mb-1">Assistant GMs:</p>
							<div className="space-y-1">
								{currentFranchise.agms.map((agm, index) => (
									<p key={index} className="text-sm text-gray-300">{agm.name}</p>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

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
																const currentValue = playerStats?.[statKey as keyof CscStats] as number | undefined;
																const targetValue = getPlayerTarget(player.name, statKey, selectedTeam.tier.name);
																const statColor = getStatColor(currentValue, targetValue, statKey);
																return (
																	<td key={`${player.name}-${statKey}`} className="px-4 py-4 whitespace-nowrap">
																		<div className={`text-sm font-semibold ${statColor}`}>
																			{currentValue !== undefined ? currentValue.toFixed(2) : "N/A"}
																		</div>
																	</td>
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
		</Container>
	);
}
