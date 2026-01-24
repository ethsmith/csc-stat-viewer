import { useQuery } from "@tanstack/react-query";
import * as React from "react";

// Extended stats spreadsheet configuration (same spreadsheet as eco ratings)
const EXTENDED_STATS_SPREADSHEET_ID = "1lcZ80NLIG2vLQvS7G3zL8tPcc6_iV24PG_V-ZmZNWHo";
const EXTENDED_STATS_SHEET_NAME = "ratings";

// Map names from the spreadsheet (internal keys)
const MAP_NAMES = ["de_nuke", "de_anubis", "de_dust2", "de_inferno", "de_overpass", "de_ancient", "de_mirage", "de_train"] as const;
export type MapName = typeof MAP_NAMES[number];

// Map display names used in spreadsheet columns (Title Case without de_ prefix)
const MAP_COLUMN_NAMES: Record<MapName, string> = {
	"de_nuke": "nuke",
	"de_anubis": "anubis",
	"de_dust2": "dust2",
	"de_inferno": "inferno",
	"de_overpass": "overpass",
	"de_ancient": "ancient",
	"de_mirage": "mirage",
	"de_train": "train",
};

// Reserved columns that are handled specially (not included in dynamic stats)
const RESERVED_COLUMNS = ["steam id", "name", "tier"];

// Helper to convert header name to a valid key (snake_case)
const headerToKey = (header: string): string => {
	return header.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
};

// Helper to convert header name to display label (Title Case)
const headerToLabel = (header: string): string => {
	return header
		.split(" ")
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
};

// Helper to categorize a stat based on its key
const categorizeStatKey = (key: string): string => {
	const lowerKey = key.toLowerCase();
	
	// Check for map-specific stats
	for (const mapName of Object.values(MAP_COLUMN_NAMES)) {
		if (lowerKey.startsWith(mapName + "_")) return "Maps";
	}
	
	if (lowerKey.includes("awp")) return "AWP";
	if (lowerKey.includes("pistol")) return "Pistol";
	if (lowerKey.includes("clutch") || lowerKey.includes("last_alive")) return "Clutch";
	if (lowerKey.includes("opening")) return "Opening";
	if (lowerKey.includes("trade")) return "Trading";
	if (lowerKey.includes("utility") || lowerKey.includes("flash")) return "Utility";
	if (lowerKey.includes("eco") || lowerKey.includes("buy") || lowerKey.includes("swing")) return "Economy";
	if (lowerKey.includes("support") || lowerKey.includes("assist") || lowerKey.includes("saved")) return "Support";
	if (lowerKey.startsWith("t_")) return "T-Side";
	if (lowerKey.startsWith("ct_")) return "CT-Side";
	if (lowerKey.includes("multi") || lowerKey.includes("_k") || lowerKey.includes("perfect")) return "Multi-Kill";
	if (["final_rating", "games", "rounds_played", "rounds_won", "rounds_lost", "hltv_rating"].includes(lowerKey)) return "Core";
	if (["kills", "deaths", "damage", "adr", "kpr", "dpr", "kast", "survival"].includes(lowerKey)) return "Combat";
	
	return "Misc";
};

// Extended player stats interface - uses dynamic stats from spreadsheet headers
// All numeric stats from the spreadsheet are added as direct properties for backward compatibility
export interface ExtendedPlayerStats {
	steam_id: string;
	name: string;
	tier: string;
	// Map-specific stats
	map_ratings: Record<MapName, number | undefined>;
	map_games_played: Record<MapName, number | undefined>;
	// All other stats are added dynamically as number properties
	// Using index signature for flexibility with dynamic columns
	[key: string]: string | number | Record<MapName, number | undefined> | undefined;
}

// Column metadata for display purposes
export interface StatColumnInfo {
	key: string;
	label: string;
	category: string;
}

// Store for dynamically discovered columns
// This array is populated when data is first fetched
export const EXTENDED_STATS_COLUMNS: StatColumnInfo[] = [];

// Also export getter function for cases where the array might not be populated yet
export const getExtendedStatsColumns = (): StatColumnInfo[] => EXTENDED_STATS_COLUMNS;

// Helper to get a stat value from a player (handles the dynamic stats structure)
export const getPlayerStat = (player: ExtendedPlayerStats, key: string): number => {
	const value = player[key];
	return typeof value === "number" ? value : 0;
};

// Helper to parse CSV line with quoted values
const parseCSVLine = (line: string): string[] => {
	const values: string[] = [];
	let current = "";
	let inQuotes = false;
	
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === "," && !inQuotes) {
			values.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	values.push(current);
	
	return values;
};

// Check if a header is a map-specific stat
const isMapSpecificHeader = (header: string): boolean => {
	for (const mapName of Object.values(MAP_COLUMN_NAMES)) {
		if (header.startsWith(mapName + " ")) return true;
	}
	return false;
};

// Fetch and parse extended stats from Google Sheets
const fetchExtendedStats = async (): Promise<ExtendedPlayerStats[]> => {
	const encodedSheetName = encodeURIComponent(EXTENDED_STATS_SHEET_NAME);
	const url = `https://docs.google.com/spreadsheets/d/${EXTENDED_STATS_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodedSheetName}`;
	
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch extended stats from Google Sheets");
	}
	
	const csvText = await response.text();
	const lines = csvText.split("\n");
	
	// Parse CSV - first line is headers
	const stats: ExtendedPlayerStats[] = [];
	
	// Find column indices from header row
	const headerLine = lines[0];
	const rawHeaders = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, "").trim());
	const headers = rawHeaders.map(h => h.toLowerCase());
	
	// Create a map of header name to index
	const headerIndex: Record<string, number> = {};
	headers.forEach((h, i) => {
		headerIndex[h] = i;
	});
	
	// Build dynamic column metadata from headers (excluding reserved and map-specific columns)
	const newColumns: StatColumnInfo[] = [];
	headers.forEach((header, idx) => {
		// Skip reserved columns and map-specific columns
		if (RESERVED_COLUMNS.includes(header)) return;
		if (isMapSpecificHeader(header)) return;
		
		const key = headerToKey(header);
		const label = headerToLabel(rawHeaders[idx]);
		const category = categorizeStatKey(key);
		
		newColumns.push({ key, label, category });
	});
	
	// Update the exported columns array (mutate in place)
	EXTENDED_STATS_COLUMNS.length = 0;
	EXTENDED_STATS_COLUMNS.push(...newColumns);
	
	// Helper to get value from row
	const getValue = (values: string[], key: string): string => {
		const idx = headerIndex[key];
		if (idx === undefined || idx >= values.length) return "";
		return values[idx].replace(/^"|"$/g, "").trim();
	};
	
	const getNumber = (values: string[], key: string): number => {
		const val = getValue(values, key);
		const num = parseFloat(val);
		return isNaN(num) ? 0 : num;
	};
	
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		
		const values = parseCSVLine(line);
		const name = getValue(values, "name");
		const tier = getValue(values, "tier");
		
		if (!name || !tier) continue;
		
		// Parse map-specific stats
		const map_ratings: Record<MapName, number | undefined> = {} as Record<MapName, number | undefined>;
		const map_games_played: Record<MapName, number | undefined> = {} as Record<MapName, number | undefined>;
		
		MAP_NAMES.forEach(mapName => {
			const colName = MAP_COLUMN_NAMES[mapName];
			const ratingVal = getValue(values, `${colName} rating`);
			const gamesVal = getValue(values, `${colName} games`);
			
			map_ratings[mapName] = ratingVal ? parseFloat(ratingVal) : undefined;
			map_games_played[mapName] = gamesVal ? parseInt(gamesVal, 10) : undefined;
		});
		
		// Dynamically parse all numeric stats from headers
		const dynamicStats: Record<string, number> = {};
		headers.forEach((header) => {
			// Skip reserved columns and map-specific columns
			if (RESERVED_COLUMNS.includes(header)) return;
			if (isMapSpecificHeader(header)) return;
			
			const key = headerToKey(header);
			dynamicStats[key] = getNumber(values, header);
		});
		
		// Spread dynamic stats directly onto the player object for backward compatibility
		const playerStats: ExtendedPlayerStats = {
			steam_id: getValue(values, "steam id"),
			name,
			tier: tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase(),
			map_ratings,
			map_games_played,
			...dynamicStats,
		};
		
		stats.push(playerStats);
	}
	
	return stats;
};

/**
 * Hook to fetch extended stats from Google Sheets, organized by tier
 */
export function useExtendedStats() {
	const { 
		data: allStats = [],
		isLoading,
		error
	} = useQuery({
		queryKey: ["extendedStats"],
		queryFn: fetchExtendedStats,
		staleTime: 60000, // Cache for 1 minute
	});

	// Organize stats by tier
	const statsByTier = React.useMemo(() => {
		const byTier: Record<string, ExtendedPlayerStats[]> = {};
		allStats.forEach(player => {
			const tier = player.tier;
			if (!byTier[tier]) {
				byTier[tier] = [];
			}
			byTier[tier].push(player);
		});
		return byTier;
	}, [allStats]);

	// Get available tiers
	const availableTiers = React.useMemo(() => {
		return Object.keys(statsByTier).sort();
	}, [statsByTier]);

	// Create a map for quick lookup by player name (lowercase)
	const statsMap = React.useMemo(() => {
		const map: Record<string, ExtendedPlayerStats> = {};
		allStats.forEach(player => {
			// Use tier + name as key since player can be in multiple tiers
			map[`${player.tier.toLowerCase()}_${player.name.toLowerCase()}`] = player;
		});
		return map;
	}, [allStats]);

	return {
		allStats,
		statsByTier,
		availableTiers,
		statsMap,
		mapNames: MAP_NAMES,
		columns: EXTENDED_STATS_COLUMNS,
		getStat: getPlayerStat,
		isLoading,
		error
	};
}
