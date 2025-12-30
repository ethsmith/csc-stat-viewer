import { useCscStatsCache } from "../../../dao/cscStatsGraphQLDao";
import { useCachedCscSeasonAndTiers } from "../../../dao/cscSeasonAndTiersDao";

/**
 * Custom hook that fetches stats for the current season, with automatic fallback
 * to last season's stats if the current season has no stats (off-season).
 * 
 * Returns the stats cache, loading state, and metadata about which season is being used.
 */
export function useStatsWithFallback() {
	const { data: seasonAndTierConfig, isLoading: isLoadingSeasonConfig } = useCachedCscSeasonAndTiers();
	const currentSeason = seasonAndTierConfig?.number ?? 0;
	const matchType = seasonAndTierConfig?.hasSeasonStarted ? "Regulation" : "Combine";

	// Fetch current season stats
	const { 
		data: currentSeasonStats, 
		isLoading: isLoadingCurrentStats 
	} = useCscStatsCache(
		currentSeason,
		matchType,
		{ enabled: currentSeason > 0 }
	);

	// Fetch last season stats (always Regulation since it's a completed season)
	const { 
		data: lastSeasonStats, 
		isLoading: isLoadingLastStats 
	} = useCscStatsCache(
		currentSeason - 1,
		"Regulation",
		{ enabled: currentSeason > 1 }
	);

	// Check if current season has any stats
	const currentSeasonHasStats = Boolean(
		currentSeasonStats?.data && 
		Object.values(currentSeasonStats.data).some(tierStats => tierStats && tierStats.length > 0)
	);

	// Use current season stats if available, otherwise fall back to last season
	const statsCache = currentSeasonHasStats ? currentSeasonStats : lastSeasonStats;
	const isUsingFallback = !currentSeasonHasStats && Boolean(lastSeasonStats);
	const effectiveSeason = currentSeasonHasStats ? currentSeason : currentSeason - 1;
	const effectiveMatchType = currentSeasonHasStats ? matchType : "Regulation";

	const isLoading = isLoadingSeasonConfig || isLoadingCurrentStats || (!currentSeasonHasStats && isLoadingLastStats);

	return {
		statsCache,
		isLoading,
		isUsingFallback,
		currentSeason,
		effectiveSeason,
		effectiveMatchType,
		seasonAndTierConfig,
	};
}
