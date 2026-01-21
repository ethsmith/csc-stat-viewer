import { useQuery } from "@tanstack/react-query";
import * as React from "react";

// Eco Rating spreadsheet configuration
// https://docs.google.com/spreadsheets/d/1lcZ80NLIG2vLQvS7G3zL8tPcc6_iV24PG_V-ZmZNWHo/edit?usp=sharing
const ECO_RATING_SPREADSHEET_ID = "1lcZ80NLIG2vLQvS7G3zL8tPcc6_iV24PG_V-ZmZNWHo";
const ECO_RATING_SHEET_NAME = "ratings";

// Map names from the spreadsheet (internal keys)
const MAP_NAMES = ["de_nuke", "de_anubis", "de_dust2", "de_inferno", "de_overpass", "de_ancient", "de_mirage", "de_train"] as const;
export type MapName = typeof MAP_NAMES[number];

// Map display names used in spreadsheet columns (lowercase for matching)
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

export interface MapData {
	rating?: number;
	gamesPlayed?: number;
}

export interface EcoRating {
	name: string;
	tier: string;
	ecoRating: number;
	mapData: Record<MapName, MapData>;
}

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

// Fetch and parse eco ratings from Google Sheets
const fetchEcoRatings = async (): Promise<EcoRating[]> => {
	const encodedSheetName = encodeURIComponent(ECO_RATING_SHEET_NAME);
	const url = `https://docs.google.com/spreadsheets/d/${ECO_RATING_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodedSheetName}`;
	
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch eco ratings from Google Sheets");
	}
	
	const csvText = await response.text();
	const lines = csvText.split("\n");
	
	// Parse CSV - first line is headers
	const ratings: EcoRating[] = [];
	
	// Find column indices from header row
	const headerLine = lines[0];
	const headers = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
	
	const nameIndex = headers.findIndex(h => h === "name");
	const tierIndex = headers.findIndex(h => h === "tier");
	const ratingIndex = headers.findIndex(h => h === "final_rating" || h === "final rating" || h === "finalrating");
	
	// Find map rating and games played column indices
	const mapRatingIndices: Record<MapName, number> = {} as Record<MapName, number>;
	const mapGamesIndices: Record<MapName, number> = {} as Record<MapName, number>;
	
	MAP_NAMES.forEach(mapName => {
		// Look for columns like "nuke rating" or "nuke games" (headers are lowercased)
		const colName = MAP_COLUMN_NAMES[mapName];
		const ratingColIndex = headers.findIndex(h => h === `${colName} rating`);
		const gamesColIndex = headers.findIndex(h => h === `${colName} games`);
		
		if (ratingColIndex !== -1) mapRatingIndices[mapName] = ratingColIndex;
		if (gamesColIndex !== -1) mapGamesIndices[mapName] = gamesColIndex;
	});
	
	if (nameIndex === -1) {
		console.error("Could not find 'Name' column in eco ratings spreadsheet. Headers:", headers);
		return [];
	}
	
	if (ratingIndex === -1) {
		console.error("Could not find rating column in eco ratings spreadsheet. Headers:", headers);
		return [];
	}
	
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		
		const values = parseCSVLine(line);
		
		if (values.length > nameIndex && values.length > ratingIndex) {
			const name = values[nameIndex].replace(/^"|"$/g, "").trim();
			const tier = tierIndex !== -1 && values.length > tierIndex 
				? values[tierIndex].replace(/^"|"$/g, "").trim().toLowerCase() 
				: "";
			const ratingStr = values[ratingIndex].replace(/^"|"$/g, "").trim();
			const ecoRating = parseFloat(ratingStr);
			
			if (name && !isNaN(ecoRating)) {
				// Parse map data
				const mapData: Record<MapName, MapData> = {} as Record<MapName, MapData>;
				
				MAP_NAMES.forEach(mapName => {
					mapData[mapName] = {};
					
					// Get map rating if column exists
					const ratingColIdx = mapRatingIndices[mapName];
					if (ratingColIdx !== undefined && values.length > ratingColIdx) {
						const mapRatingStr = values[ratingColIdx].replace(/^"|"$/g, "").trim();
						const mapRating = parseFloat(mapRatingStr);
						if (!isNaN(mapRating)) {
							mapData[mapName].rating = mapRating;
						}
					}
					
					// Get games played if column exists
					const gamesColIdx = mapGamesIndices[mapName];
					if (gamesColIdx !== undefined && values.length > gamesColIdx) {
						const gamesStr = values[gamesColIdx].replace(/^"|"$/g, "").trim();
						const games = parseInt(gamesStr, 10);
						if (!isNaN(games)) {
							mapData[mapName].gamesPlayed = games;
						}
					}
				});
				
				ratings.push({ name, tier, ecoRating, mapData });
			}
		}
	}
	
	return ratings;
};

/**
 * Hook to fetch eco ratings from Google Sheets and provide a lookup map
 */
export function useEcoRatings() {
	const { 
		data: ecoRatings = [],
		isLoading,
		error
	} = useQuery({
		queryKey: ["ecoRatings"],
		queryFn: fetchEcoRatings,
		staleTime: 60000, // Cache for 1 minute
	});

	// Create a map for quick lookup of eco ratings by player name and tier (key: "name:tier")
	const ecoRatingMapByTier = React.useMemo(() => {
		const map: Record<string, number> = {};
		ecoRatings.forEach(player => {
			const key = `${player.name.toLowerCase()}:${player.tier}`;
			map[key] = player.ecoRating;
		});
		return map;
	}, [ecoRatings]);

	// Create a map for quick lookup of full player eco data by name and tier (key: "name:tier")
	const ecoDataMapByTier = React.useMemo(() => {
		const map: Record<string, EcoRating> = {};
		ecoRatings.forEach(player => {
			const key = `${player.name.toLowerCase()}:${player.tier}`;
			map[key] = player;
		});
		return map;
	}, [ecoRatings]);

	// Legacy maps (without tier) - will use the last entry for each player
	const ecoRatingMap = React.useMemo(() => {
		const map: Record<string, number> = {};
		ecoRatings.forEach(player => {
			map[player.name.toLowerCase()] = player.ecoRating;
		});
		return map;
	}, [ecoRatings]);

	const ecoDataMap = React.useMemo(() => {
		const map: Record<string, EcoRating> = {};
		ecoRatings.forEach(player => {
			map[player.name.toLowerCase()] = player;
		});
		return map;
	}, [ecoRatings]);

	return {
		ecoRatings,
		ecoRatingMap,
		ecoDataMap,
		ecoRatingMapByTier,
		ecoDataMapByTier,
		mapNames: MAP_NAMES,
		isLoading,
		error
	};
}
