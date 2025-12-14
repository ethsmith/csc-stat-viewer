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
type TargetRatings = Record<string, number>;
type PlayerRoles = Record<string, string>;
type PlayerRole = "IGL" | "AWPER" | "ENTRY" | "SUPPORT" | "RIFLER" | "LURKER";

const PLAYER_ROLES: PlayerRole[] = ["IGL", "AWPER", "ENTRY", "SUPPORT", "RIFLER", "LURKER"];

const getFranchiseImage = (prefix: string): string => {
	return franchiseImages[prefix] || "";
};

export function Dashboard() {
	const { data: franchises = [], isLoading } = useFetchFranchisesGraph();
	const [selectedFranchise, setSelectedFranchise] = useLocalStorage("franchise", "");
	const [searchQuery, setSearchQuery] = React.useState("");
	const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);
	const [targetRatings, setTargetRatings] = useLocalStorage("playerTargetRatings", "{}");
	const [playerRoles, setPlayerRoles] = useLocalStorage("playerRoles", "{}");
	
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

	const parsedTargetRatings: TargetRatings = React.useMemo(() => {
		try {
			return JSON.parse(targetRatings);
		} catch {
			return {};
		}
	}, [targetRatings]);

	const parsedPlayerRoles: PlayerRoles = React.useMemo(() => {
		try {
			return JSON.parse(playerRoles);
		} catch {
			return {};
		}
	}, [playerRoles]);

	const setPlayerTargetRating = (playerName: string, rating: number) => {
		const updated = { ...parsedTargetRatings, [playerName]: rating };
		setTargetRatings(JSON.stringify(updated));
	};

	const setPlayerRole = (playerName: string, role: string) => {
		const updated = { ...parsedPlayerRoles, [playerName]: role };
		setPlayerRoles(JSON.stringify(updated));
	};

	const getRatingColor = (currentRating: number | undefined, targetRating: number | undefined) => {
		if (!currentRating || !targetRating) return "text-gray-300";
		const diff = currentRating - targetRating;
		if (diff > 0.03) return "text-green-400";
		if (diff >= 0) return "text-blue-400";
		if (diff >= -0.03) return "text-yellow-400";
		return "text-red-400";
	};

	return (
		<Container>
			<div className="flex justify-between items-center mb-8">
				<div>
					<h2 className="text-3xl font-bold">Franchise Dashboard</h2>
					{currentFranchise && (
						<p className="mt-2 text-gray-300">
							Managing: <span className="font-semibold text-blue-400">{currentFranchise.name}</span>
						</p>
					)}
				</div>
				<button
					onClick={handleClearFranchise}
					className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
				>
					Change Franchise
				</button>
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
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
													Rating
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
													Target Rating
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
													K/D
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
													ADR
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
													Role
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-700">
											{selectedTeam.players && selectedTeam.players.length > 0 ? (
												selectedTeam.players.map((player, index) => {
													const playerStats = getPlayerStats(player.name, selectedTeam.tier.name);
													const kd = playerStats ? (playerStats.kills / (playerStats.deaths || 1)).toFixed(2) : "N/A";
													const targetRating = parsedTargetRatings[player.name];
													const ratingColor = getRatingColor(playerStats?.rating, targetRating);
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
															<td className="px-6 py-4 whitespace-nowrap">
																<div className={`text-sm font-semibold ${ratingColor}`}>
																	{playerStats?.rating ? playerStats.rating.toFixed(2) : "N/A"}
																</div>
															</td>
															<td className="px-6 py-4 whitespace-nowrap">
																<input
																	type="number"
																	step="0.01"
																	min="0"
																	placeholder="Set target"
																	value={targetRating || ""}
																	onChange={(e) => {
																		const value = parseFloat(e.target.value);
																		if (!isNaN(value) && value >= 0) {
																			setPlayerTargetRating(player.name, value);
																		}
																	}}
																	className="w-24 px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
																/>
															</td>
															<td className="px-6 py-4 whitespace-nowrap">
																<div className="text-sm text-gray-300">{kd}</div>
															</td>
															<td className="px-6 py-4 whitespace-nowrap">
																<div className="text-sm text-gray-300">
																	{playerStats?.adr ? playerStats.adr.toFixed(1) : "N/A"}
																</div>
															</td>
															<td className="px-6 py-4 whitespace-nowrap">
																<div className="flex items-center gap-2">
																	<select
																		value={parsedPlayerRoles[player.name] || ""}
																		onChange={(e) => setPlayerRole(player.name, e.target.value)}
																		className="w-28 px-2 py-1 text-xs bg-gray-700 text-white border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
																	>
																		<option value="">Select Role</option>
																		{PLAYER_ROLES.map(role => (
																			<option key={role} value={role}>{role}</option>
																		))}
																	</select>
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
													<td colSpan={7} className="px-6 py-8 text-center text-gray-400">
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
