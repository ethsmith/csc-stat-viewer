import * as React from "react";
import { Container } from "../../common/components/container";
import { Loading } from "../../common/components/loading";
import { useFetchFranchisesGraph } from "../../dao/franchisesGraphQLDao";
import { useLocalStorage } from "../../common/hooks/localStorage";
import { useStatsWithFallback } from "./hooks/useStatsWithFallback";
import { Link, useLocation } from "wouter";
import { CscStats } from "../../models/csc-stats-types";
import { GMSidebar } from "./components/GMSidebar";
import { OffSeasonBanner } from "./components/OffSeasonBanner";
import { TeamTabs } from "./components/TeamTabs";
import { TierInfoCard } from "./components/TierInfoCard";
import { PlayerTargets, PlayerRoles, PLAYER_ROLES, AVAILABLE_STATS } from "./types";
import {
	getPlayerTarget,
	getStatColor,
	getStatColorStyle,
	handleExportSettings,
	createImportHandler,
	parseColorblindColors
} from "./utils";

export function SetTargets() {
	const { data: franchises = [], isLoading } = useFetchFranchisesGraph();
	const [selectedFranchise] = useLocalStorage("franchise", "");
	const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);
	const [playerTargets, setPlayerTargets] = useLocalStorage("playerTargets", "{}");
	const [playerRoles, setPlayerRoles] = useLocalStorage("playerRoles", "{}");
	const [selectedStats, setSelectedStats] = useLocalStorage("selectedTargetStats", '["rating"]');
	const [statSearchQuery, setStatSearchQuery] = React.useState("");
	const [showStatSelector, setShowStatSelector] = React.useState(false);
	const [colorblindMode, setColorblindMode] = useLocalStorage("colorblindMode", "false");
	const [colorblindColors, setColorblindColors] = useLocalStorage("colorblindColors", JSON.stringify({ good: "#22d3ee", warning: "#fb923c", bad: "#c084fc" }));
	const [, setLocation] = useLocation();
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	
	const { 
		statsCache, 
		isLoading: isLoadingStats,
		isUsingFallback,
		effectiveSeason 
	} = useStatsWithFallback();


	const currentFranchise = franchises.find(f => f.prefix === selectedFranchise);

	React.useEffect(() => {
		if (!selectedFranchise) {
			setLocation("/dashboard");
		}
	}, [selectedFranchise, setLocation]);

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

	const setPlayerTargetForStat = (playerName: string, statKey: string, value: number) => {
		const playerData = parsedPlayerTargets[playerName] || {};
		const updated = { ...parsedPlayerTargets, [playerName]: { ...playerData, [statKey]: value } };
		setPlayerTargets(JSON.stringify(updated));
	};

	const addStatToTrack = (statKey: string) => {
		if (!parsedSelectedStats.includes(statKey)) {
			const updated = [...parsedSelectedStats, statKey];
			setSelectedStats(JSON.stringify(updated));
		}
		setShowStatSelector(false);
		setStatSearchQuery("");
	};

	const removeStatFromTrack = (statKey: string) => {
		if (parsedSelectedStats.length > 1) {
			const updated = parsedSelectedStats.filter(s => s !== statKey);
			setSelectedStats(JSON.stringify(updated));
		}
	};

	const setPlayerRole = (playerName: string, role: string) => {
		const updated = { ...parsedPlayerRoles, [playerName]: role };
		setPlayerRoles(JSON.stringify(updated));
	};


	const handleExport = () => {
		handleExportSettings(selectedFranchise, playerTargets, playerRoles, selectedStats, undefined, undefined, undefined, undefined, colorblindMode, colorblindColors);
	};

	const handleImportSettings = createImportHandler(
		setPlayerTargets,
		setPlayerRoles,
		setSelectedStats,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		setColorblindMode,
		setColorblindColors
	);

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleChangeFranchise = () => {
		setLocation('/dashboard');
	};

	const filteredStats = React.useMemo(() => {
		if (!statSearchQuery) return AVAILABLE_STATS;
		const query = statSearchQuery.toLowerCase();
		return AVAILABLE_STATS.filter(
			stat => 
				stat.label.toLowerCase().includes(query) ||
				stat.description.toLowerCase().includes(query) ||
				stat.key.toLowerCase().includes(query)
		);
	}, [statSearchQuery]);

	if (isLoading || isLoadingStats) {
		return (
			<Container>
				<Loading />
			</Container>
		);
	}

	if (!currentFranchise) {
		return (
			<Container>
				<Loading />
			</Container>
		);
	}

	return (
		<div className="flex h-screen bg-gray-900">
			<GMSidebar
				currentFranchise={currentFranchise}
				currentPage="targets"
				onExport={handleExport}
				onImport={handleImportClick}
				onChangeFranchise={handleChangeFranchise}
				fileInputRef={fileInputRef}
				onFileChange={handleImportSettings}
				colorblindMode={colorblindMode === "true"}
				onToggleColorblindMode={() => setColorblindMode(colorblindMode === "true" ? "false" : "true")}
				colorblindColors={parseColorblindColors(colorblindColors)}
				onColorblindColorsChange={(colors) => setColorblindColors(JSON.stringify(colors))}
			/>

			{/* Main Content */}
			<div className="flex-1 overflow-auto">
				<Container>
					{isUsingFallback && <OffSeasonBanner effectiveSeason={effectiveSeason} />}
					{currentFranchise && currentFranchise.teams && currentFranchise.teams.length > 0 && (
				<div className="mt-8">
					<TeamTabs
						teams={currentFranchise.teams}
						selectedTeamId={selectedTeamId}
						onSelectTeam={setSelectedTeamId}
					/>

					{selectedTeam && (
						<div>
							<TierInfoCard
								tierName={selectedTeam.tier.name}
								mmrCap={selectedTeam.tier.mmrCap}
								playerCount={selectedTeam.players?.length || 0}
							/>

							<div className="mb-6 flex items-center justify-between">
								<div className="flex items-center gap-3 flex-wrap">
									<h3 className="text-lg font-bold">Tracked Stats:</h3>
									{parsedSelectedStats.map(statKey => {
										const statInfo = AVAILABLE_STATS.find(s => s.key === statKey);
										return (
											<div key={statKey} className="flex items-center gap-2 px-3 py-1 bg-blue-600 rounded-lg">
												<span className="text-sm font-medium">{statInfo?.label || statKey}</span>
												{parsedSelectedStats.length > 1 && (
													<button
														onClick={() => removeStatFromTrack(statKey)}
														className="text-white hover:text-red-300 transition-colors"
														title="Remove stat"
													>
														✕
													</button>
												)}
											</div>
										);
									})}
									<button
										onClick={() => setShowStatSelector(!showStatSelector)}
										className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm font-medium"
									>
										+ Add Stat
									</button>
								</div>
							</div>

							{showStatSelector && (
								<div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
									<div className="mb-4">
										<input
											type="text"
											placeholder="Search stats..."
											value={statSearchQuery}
											onChange={(e) => setStatSearchQuery(e.target.value)}
											className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
										/>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
										{filteredStats.map(stat => {
											const isSelected = parsedSelectedStats.includes(stat.key);
											return (
												<button
													key={stat.key}
													onClick={() => !isSelected && addStatToTrack(stat.key)}
													disabled={isSelected}
													className={`p-3 rounded-lg border text-left transition-colors ${
														isSelected
															? "bg-gray-700 border-gray-600 opacity-50 cursor-not-allowed"
															: "bg-gray-750 border-gray-600 hover:border-blue-500 hover:bg-gray-700"
													}`}
												>
													<div className="font-semibold text-sm text-white">{stat.label}</div>
													<div className="text-xs text-gray-400 mt-1">{stat.description}</div>
													{isSelected && <div className="text-xs text-green-400 mt-1">✓ Already tracking</div>}
												</button>
											);
										})}
									</div>
								</div>
							)}

							<div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead className="bg-gray-900">
											<tr>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-900 z-10">
													Player
												</th>
												{parsedSelectedStats.map(statKey => {
													const statInfo = AVAILABLE_STATS.find(s => s.key === statKey);
													return (
														<th key={`${statKey}-current`} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" colSpan={3}>
															<div className="flex items-center gap-2">
																<span>{statInfo?.label || statKey}</span>
															</div>
														</th>
													);
												})}
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
													Role
												</th>
											</tr>
											<tr>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-900 z-10"></th>
												{parsedSelectedStats.map(statKey => (
													<React.Fragment key={`${statKey}-headers`}>
														<th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Current</th>
														<th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Target</th>
														<th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Diff</th>
													</React.Fragment>
												))}
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500"></th>
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-700">
											{selectedTeam.players && selectedTeam.players.length > 0 ? (
											selectedTeam.players.map((player, index) => {
												const playerStats = getPlayerStats(player.name, selectedTeam.tier.name);
												const playerTargetData = parsedPlayerTargets[player.name] || {};

												return (
													<tr key={player.steam64Id || index} className="hover:bg-gray-750">
														<td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-gray-800 z-10">
															<Link href={`/players/${player.name}`}>
																<div className="text-sm font-medium text-white hover:text-blue-400 cursor-pointer transition-colors">
																	{player.name}
																</div>
															</Link>
														</td>
														{parsedSelectedStats.map(statKey => {
															const currentValue = playerStats?.[statKey as keyof CscStats] as number | undefined;
															const explicitTarget = playerTargetData[statKey];
															const targetValue = getPlayerTarget(parsedPlayerTargets, statsCache, player.name, statKey, selectedTeam.tier.name);
															const parsedColors = parseColorblindColors(colorblindColors);
															const statColor = getStatColor(currentValue, targetValue, statKey, colorblindMode === "true", parsedColors);
															const statColorStyle = getStatColorStyle(currentValue, targetValue, statKey, colorblindMode === "true", parsedColors);
															const diff = currentValue !== undefined && targetValue !== undefined
																? (currentValue - targetValue).toFixed(2)
																: "N/A";

																return (
																	<React.Fragment key={`${player.name}-${statKey}`}>
																		<td className="px-2 py-4 whitespace-nowrap">
																			<div className={`text-sm font-semibold ${statColor}`} style={statColorStyle}>
																				{currentValue !== undefined ? currentValue.toFixed(2) : "N/A"}
																			</div>
																		</td>
																		<td className="px-2 py-4 whitespace-nowrap">
																			<input
																				type="number"
																				step="0.01"
																				min="0"
																				placeholder={targetValue !== undefined ? targetValue.toFixed(2) : "Auto"}
																				value={explicitTarget !== undefined ? explicitTarget : ""}
																				onChange={(e) => {
																					const value = parseFloat(e.target.value);
																					if (!isNaN(value) && value >= 0) {
																						setPlayerTargetForStat(player.name, statKey, value);
																					}
																				}}
																				className="w-20 px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
																			/>
																		</td>
																		<td className="px-2 py-4 whitespace-nowrap">
																			<div className={`text-sm font-semibold ${statColor}`} style={statColorStyle}>
																				{diff !== "N/A" && parseFloat(diff) > 0 ? "+" : ""}{diff}
																			</div>
																		</td>
																	</React.Fragment>
																);
															})}
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
													<td colSpan={parsedSelectedStats.length * 3 + 2} className="px-6 py-8 text-center text-gray-400">
														No players on this team
													</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
							</div>

							<div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
								<h3 className="text-lg font-bold mb-3">Color Legend</h3>
								<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
									<div className="flex items-center gap-2">
										<div 
											className={`w-4 h-4 rounded ${colorblindMode !== "true" ? "bg-green-400" : ""}`}
											style={colorblindMode === "true" ? { backgroundColor: parseColorblindColors(colorblindColors).good } : {}}
										></div>
										<span className="text-gray-300">Above target</span>
									</div>
									<div className="flex items-center gap-2">
										<div 
											className={`w-4 h-4 rounded ${colorblindMode !== "true" ? "bg-blue-400" : ""}`}
											style={colorblindMode === "true" ? { backgroundColor: parseColorblindColors(colorblindColors).atTarget } : {}}
										></div>
										<span className="text-gray-300">At target</span>
									</div>
									<div className="flex items-center gap-2">
										<div 
											className={`w-4 h-4 rounded ${colorblindMode !== "true" ? "bg-yellow-400" : ""}`}
											style={colorblindMode === "true" ? { backgroundColor: parseColorblindColors(colorblindColors).warning } : {}}
										></div>
										<span className="text-gray-300">Close to target</span>
									</div>
									<div className="flex items-center gap-2">
										<div 
											className={`w-4 h-4 rounded ${colorblindMode !== "true" ? "bg-red-400" : ""}`}
											style={colorblindMode === "true" ? { backgroundColor: parseColorblindColors(colorblindColors).bad } : {}}
										></div>
										<span className="text-gray-300">Below target</span>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			)}
				</Container>
			</div>
		</div>
	);
}
