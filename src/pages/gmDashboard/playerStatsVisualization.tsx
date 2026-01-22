import * as React from "react";
import { Container } from "../../common/components/container";
import { Loading } from "../../common/components/loading";
import { useRoute, Link } from "wouter";
import { useStatsWithFallback } from "./hooks/useStatsWithFallback";
import { CscStats } from "../../models/csc-stats-types";
import { ALL_STATS, StatDefinition } from "./types";
import { useCscPlayersCache } from "../../dao/cscPlayerGraphQLDao";
import { useExtendedStats, ExtendedPlayerStats, EXTENDED_STATS_COLUMNS, EXTENDED_STATS_CATEGORIES } from "./hooks/useExtendedStats";

interface StatRanking {
	key: string;
	label: string;
	category?: string;
	value: number;
	rank: number;
	totalPlayers: number;
	percentile: number;
}

export function PlayerStatsVisualization() {
	const [, params] = useRoute("/dashboard/player-stats/:tier/:name");
	const playerName = decodeURIComponent(params?.name ?? "");
	const tier = decodeURIComponent(params?.tier ?? "");
	const [statsSource, setStatsSource] = React.useState<"csc" | "extended">("csc");
	const [selectedCategory, setSelectedCategory] = React.useState<string>("all");

	const { 
		statsCache, 
		isLoading: isLoadingStats,
		effectiveSeason 
	} = useStatsWithFallback();

	const { data: playersData } = useCscPlayersCache(effectiveSeason);

	// Extended stats
	const { 
		statsByTier: extendedStatsByTier, 
		isLoading: isLoadingExtendedStats 
	} = useExtendedStats();

	// CSC Stats players
	const tierPlayers: CscStats[] = React.useMemo(() => {
		if (!statsCache?.data || !tier) return [];
		return statsCache.data[tier as keyof typeof statsCache.data] || [];
	}, [statsCache, tier]);

	// Filter CSC players to only include players whose CURRENT tier matches the selected tier
	const currentTierPlayers: CscStats[] = React.useMemo(() => {
		if (!playersData) return tierPlayers;
		return tierPlayers.filter(p => {
			const playerInfo = playersData.find(pd => pd.name.toLowerCase() === p.name.toLowerCase());
			if (playerInfo?.tier?.name) {
				return playerInfo.tier.name === tier;
			}
			return true;
		});
	}, [tierPlayers, playersData, tier]);

	// Extended stats players - filter to current tier only
	const extendedTierPlayers: ExtendedPlayerStats[] = React.useMemo(() => {
		if (!playersData) return extendedStatsByTier[tier] || [];
		const tierStats = extendedStatsByTier[tier] || [];
		
		// Get all players whose current roster tier matches the selected tier
		const playersInCurrentTier = playersData.filter(pd => pd.tier?.name === tier);
		
		// For each player in the current tier, find their stats
		const result: ExtendedPlayerStats[] = [];
		playersInCurrentTier.forEach(pd => {
			const playerStats = tierStats.find(s => s.name.toLowerCase() === pd.name.toLowerCase());
			if (playerStats) {
				result.push(playerStats);
			}
		});
		
		return result;
	}, [extendedStatsByTier, playersData, tier]);

	const currentPlayer = React.useMemo(() => {
		return currentTierPlayers.find(p => p.name === playerName);
	}, [currentTierPlayers, playerName]);

	const currentExtendedPlayer = React.useMemo(() => {
		return extendedTierPlayers.find(p => p.name === playerName);
	}, [extendedTierPlayers, playerName]);

	const playerData = React.useMemo(() => {
		if (!playersData) return null;
		return playersData.find(pd => pd.name.toLowerCase() === playerName.toLowerCase());
	}, [playersData, playerName]);

	// CSC stat rankings
	const cscStatRankings: StatRanking[] = React.useMemo(() => {
		if (!currentPlayer || currentTierPlayers.length === 0) return [];

		const rankings: StatRanking[] = [];

		ALL_STATS.forEach(stat => {
			const playerValue = currentPlayer[stat.key] as number | undefined;
			if (playerValue === undefined) return;

			const lowerIsBetter = ["deaths", "adp"].includes(stat.key);
			
			const playersWithStat = currentTierPlayers
				.filter(p => p[stat.key] !== undefined)
				.sort((a, b) => {
					const aVal = a[stat.key] as number;
					const bVal = b[stat.key] as number;
					return lowerIsBetter ? aVal - bVal : bVal - aVal;
				});

			const rank = playersWithStat.findIndex(p => p.name === playerName) + 1;
			const totalPlayers = playersWithStat.length;
			const percentile = ((totalPlayers - rank + 1) / totalPlayers) * 100;

			rankings.push({
				key: stat.key,
				label: stat.label,
				value: playerValue,
				rank,
				totalPlayers,
				percentile,
			});
		});

		return rankings.sort((a, b) => a.rank - b.rank);
	}, [currentPlayer, currentTierPlayers, playerName]);

	// Extended stat rankings
	const extendedStatRankings: StatRanking[] = React.useMemo(() => {
		if (!currentExtendedPlayer || extendedTierPlayers.length === 0) return [];

		const rankings: StatRanking[] = [];
		const lowerIsBetterStats = ["deaths", "dpr", "opening_deaths", "opening_deaths_per_round", "awp_deaths", "awp_deaths_no_kill", "early_deaths", "team_flash_count", "team_flash_duration_per_round"];

		EXTENDED_STATS_COLUMNS.forEach(col => {
			const playerValue = currentExtendedPlayer[col.key] as number | undefined;
			if (playerValue === undefined || playerValue === null) return;

			const lowerIsBetter = lowerIsBetterStats.includes(col.key);
			
			const playersWithStat = extendedTierPlayers
				.filter(p => p[col.key] !== undefined && p[col.key] !== null)
				.sort((a, b) => {
					const aVal = a[col.key] as number;
					const bVal = b[col.key] as number;
					return lowerIsBetter ? aVal - bVal : bVal - aVal;
				});

			const rank = playersWithStat.findIndex(p => p.name === playerName) + 1;
			if (rank === 0) return; // Player not found in sorted list
			
			const totalPlayers = playersWithStat.length;
			const percentile = ((totalPlayers - rank + 1) / totalPlayers) * 100;

			rankings.push({
				key: col.key,
				label: col.label,
				category: col.category,
				value: playerValue,
				rank,
				totalPlayers,
				percentile,
			});
		});

		return rankings.sort((a, b) => a.rank - b.rank);
	}, [currentExtendedPlayer, extendedTierPlayers, playerName]);

	// Use the appropriate rankings based on stats source
	const statRankings = statsSource === "csc" ? cscStatRankings : extendedStatRankings;
	
	// Filter by category if extended stats and category selected
	const filteredRankings = React.useMemo(() => {
		if (statsSource === "csc" || selectedCategory === "all") return statRankings;
		return statRankings.filter(r => r.category === selectedCategory);
	}, [statRankings, statsSource, selectedCategory]);

	const top5Stats = filteredRankings.filter(r => r.rank <= 5);
	const top10Stats = filteredRankings.filter(r => r.rank > 5 && r.rank <= 10);
	const otherStats = filteredRankings.filter(r => r.rank > 10);

	const getStatColor = (rank: number): string => {
		if (rank <= 5) return "from-yellow-500 to-amber-600";
		if (rank <= 10) return "from-blue-500 to-cyan-600";
		if (rank <= 20) return "from-green-600 to-emerald-700";
		return "from-gray-600 to-gray-700";
	};

	const getStatBorderColor = (rank: number): string => {
		if (rank <= 5) return "border-yellow-500";
		if (rank <= 10) return "border-blue-500";
		if (rank <= 20) return "border-green-600";
		return "border-gray-600";
	};

	const getRankBadge = (rank: number): React.ReactNode => {
		if (rank === 1) {
			return <span className="text-2xl">🥇</span>;
		}
		if (rank === 2) {
			return <span className="text-2xl">🥈</span>;
		}
		if (rank === 3) {
			return <span className="text-2xl">🥉</span>;
		}
		if (rank <= 5) {
			return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full">#{rank}</span>;
		}
		if (rank <= 10) {
			return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full">#{rank}</span>;
		}
		return <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs font-bold rounded-full">#{rank}</span>;
	};

	const formatValue = (value: number, statKey: string): string => {
		if (Number.isInteger(value)) return value.toString();
		// CSC stats that are percentages stored as decimals
		if (["kast", "hs", "odr", "clutchR", "saveRate", "tRatio", "suppR"].includes(statKey)) {
			return (value * 100).toFixed(1) + "%";
		}
		// Extended stats that end in _pct are already percentages
		if (statKey.endsWith("_pct") || statKey.endsWith("_win_pct")) {
			return value.toFixed(1) + "%";
		}
		return value.toFixed(2);
	};

	const StatCard = ({ ranking, size = "normal" }: { ranking: StatRanking; size?: "large" | "normal" | "small" }) => {
		const isLarge = size === "large";
		const isSmall = size === "small";
		
		return (
			<div 
				className={`relative overflow-hidden rounded-xl border-2 ${getStatBorderColor(ranking.rank)} bg-gray-800 transition-all hover:scale-105 hover:shadow-lg hover:shadow-black/30 ${
					isLarge ? "p-6" : isSmall ? "p-3" : "p-4"
				}`}
			>
				<div className={`absolute inset-0 bg-gradient-to-br ${getStatColor(ranking.rank)} opacity-10`} />
				<div className="relative z-10">
					<div className="flex items-start justify-between mb-2">
						<div className={`font-bold text-white ${isLarge ? "text-lg" : isSmall ? "text-xs" : "text-sm"}`}>
							{ranking.label}
							{ranking.category && <span className="text-gray-500 text-xs ml-1">({ranking.category})</span>}
						</div>
						{getRankBadge(ranking.rank)}
					</div>
					<div className={`font-bold text-white ${isLarge ? "text-4xl" : isSmall ? "text-xl" : "text-2xl"} mb-1`}>
						{formatValue(ranking.value, ranking.key)}
					</div>
					<div className={`text-gray-400 ${isSmall ? "text-xs" : "text-sm"}`}>
						{ranking.rank} of {ranking.totalPlayers} players
					</div>
					<div className="mt-2 w-full bg-gray-700 rounded-full h-2">
						<div 
							className={`h-2 rounded-full bg-gradient-to-r ${getStatColor(ranking.rank)}`}
							style={{ width: `${ranking.percentile}%` }}
						/>
					</div>
					<div className={`text-gray-500 mt-1 ${isSmall ? "text-xs" : "text-xs"}`}>
						Top {(100 - ranking.percentile).toFixed(0)}%
					</div>
				</div>
			</div>
		);
	};

	if (isLoadingStats || isLoadingExtendedStats) {
		return (
			<Container>
				<Loading />
			</Container>
		);
	}

	const hasAnyStats = currentPlayer || currentExtendedPlayer;

	if (!hasAnyStats) {
		return (
			<Container>
				<div className="text-center py-12">
					<h1 className="text-2xl font-bold text-white mb-4">Player Not Found</h1>
					<p className="text-gray-400 mb-6">Could not find stats for "{playerName}" in {tier} tier.</p>
					<Link href="/dashboard/table">
						<button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
							Back to Table View
						</button>
					</Link>
				</div>
			</Container>
		);
	}

	return (
		<div className="min-h-screen bg-gray-900 p-6">
			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<Link href="/dashboard/table">
						<button className="text-gray-400 hover:text-white mb-4 flex items-center gap-2 transition-colors">
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
							</svg>
							Back to Table View
						</button>
					</Link>
					<div className="flex items-center gap-4">
						<div>
							<h1 className="text-4xl font-bold text-white">{playerName}</h1>
							<div className="flex items-center gap-3 mt-2">
								<span className="px-3 py-1 bg-purple-600/30 text-purple-300 rounded-full text-sm font-medium">
									{tier}
								</span>
								{playerData?.team?.name && (
									<span className="text-gray-400">
										{playerData.team.name}
									</span>
								)}
								<span className="text-gray-500">
									{statsSource === "csc" && currentPlayer ? `${currentPlayer.gameCount} games played` : ""}
									{statsSource === "extended" && currentExtendedPlayer ? `${currentExtendedPlayer.games_count} games played` : ""}
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Stats Source Toggle */}
				<div className="mb-6 flex flex-wrap items-center gap-4">
					<div className="flex items-center gap-2">
						<span className="text-sm text-gray-400">Stats Source:</span>
						<div className="inline-flex rounded-lg overflow-hidden border border-gray-700">
							<button
								onClick={() => setStatsSource("csc")}
								className={`px-4 py-2 text-sm font-medium transition-colors ${
									statsSource === "csc"
										? "bg-blue-600 text-white"
										: "bg-gray-800 text-gray-400 hover:bg-gray-700"
								}`}
							>
								CSC Stats ({cscStatRankings.length})
							</button>
							<button
								onClick={() => setStatsSource("extended")}
								className={`px-4 py-2 text-sm font-medium transition-colors ${
									statsSource === "extended"
										? "bg-purple-600 text-white"
										: "bg-gray-800 text-gray-400 hover:bg-gray-700"
								}`}
							>
								Extended Stats ({extendedStatRankings.length})
							</button>
						</div>
					</div>

					{/* Category Filter for Extended Stats */}
					{statsSource === "extended" && (
						<div className="flex items-center gap-2">
							<span className="text-sm text-gray-400">Category:</span>
							<select
								value={selectedCategory}
								onChange={(e) => setSelectedCategory(e.target.value)}
								className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
							>
								<option value="all">All Categories</option>
								{EXTENDED_STATS_CATEGORIES.map(cat => (
									<option key={cat} value={cat}>{cat}</option>
								))}
							</select>
						</div>
					)}
				</div>

				{/* Legend */}
				<div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
					<h3 className="text-sm font-bold text-white mb-3">Ranking Legend</h3>
					<div className="flex flex-wrap gap-6 text-sm">
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 rounded bg-gradient-to-r from-yellow-500 to-amber-600" />
							<span className="text-gray-300">Top 5 in tier</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 rounded bg-gradient-to-r from-blue-500 to-cyan-600" />
							<span className="text-gray-300">Top 10 in tier</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 rounded bg-gradient-to-r from-green-600 to-emerald-700" />
							<span className="text-gray-300">Top 20 in tier</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 rounded bg-gradient-to-r from-gray-600 to-gray-700" />
							<span className="text-gray-300">Other</span>
						</div>
					</div>
				</div>

				{/* Top 5 Stats - Featured Section */}
				{top5Stats.length > 0 && (
					<div className="mb-8">
						<h2 className="text-2xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
							<span className="text-3xl">⭐</span> Elite Stats (Top 5)
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{top5Stats.map(ranking => (
								<StatCard key={ranking.key} ranking={ranking} size="large" />
							))}
						</div>
					</div>
				)}

				{/* Top 10 Stats */}
				{top10Stats.length > 0 && (
					<div className="mb-8">
						<h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
							<span className="text-2xl">🔥</span> Strong Stats (Top 10)
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
							{top10Stats.map(ranking => (
								<StatCard key={ranking.key} ranking={ranking} size="normal" />
							))}
						</div>
					</div>
				)}

				{/* Other Stats */}
				{otherStats.length > 0 && (
					<div className="mb-8">
						<h2 className="text-lg font-bold text-gray-400 mb-4">All Other Stats</h2>
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
							{otherStats.map(ranking => (
								<StatCard key={ranking.key} ranking={ranking} size="small" />
							))}
						</div>
					</div>
				)}

				{/* Summary Stats */}
				<div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-700">
					<h3 className="text-lg font-bold text-white mb-4">
						Player Summary 
						{statsSource === "extended" && selectedCategory !== "all" && (
							<span className="text-purple-400 text-sm font-normal ml-2">({selectedCategory})</span>
						)}
					</h3>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
						<div className="text-center">
							<div className="text-4xl font-bold text-yellow-400">{top5Stats.length}</div>
							<div className="text-gray-400 text-sm">Top 5 Stats</div>
						</div>
						<div className="text-center">
							<div className="text-4xl font-bold text-blue-400">{top10Stats.length}</div>
							<div className="text-gray-400 text-sm">Top 6-10 Stats</div>
						</div>
						<div className="text-center">
							<div className="text-4xl font-bold text-green-400">
								{filteredRankings.filter(r => r.rank <= 20).length}
							</div>
							<div className="text-gray-400 text-sm">Top 20 Stats</div>
						</div>
						<div className="text-center">
							<div className="text-4xl font-bold text-white">
								{filteredRankings.length > 0 
									? Math.round(filteredRankings.reduce((sum, r) => sum + r.percentile, 0) / filteredRankings.length)
									: 0}%
							</div>
							<div className="text-gray-400 text-sm">Avg Percentile</div>
						</div>
					</div>
				</div>

				{/* Link to full player page */}
				<div className="mt-6 text-center">
					<Link href={`/players/${encodeURIComponent(playerName)}`}>
						<button className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
							View Full Player Profile →
						</button>
					</Link>
				</div>
			</div>
		</div>
	);
}
