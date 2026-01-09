import { useQuery } from "@tanstack/react-query";
import * as React from "react";

// Eco Rating spreadsheet configuration
// https://docs.google.com/spreadsheets/d/1lcZ80NLIG2vLQvS7G3zL8tPcc6_iV24PG_V-ZmZNWHo/edit?usp=sharing
const ECO_RATING_SPREADSHEET_ID = "1lcZ80NLIG2vLQvS7G3zL8tPcc6_iV24PG_V-ZmZNWHo";
const ECO_RATING_SHEET_NAME = "ratings";

interface EcoRating {
	name: string;
	ecoRating: number;
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
	const ratingIndex = headers.findIndex(h => h === "final_rating" || h === "final rating" || h === "finalrating");
	
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
			const ratingStr = values[ratingIndex].replace(/^"|"$/g, "").trim();
			const ecoRating = parseFloat(ratingStr);
			
			if (name && !isNaN(ecoRating)) {
				ratings.push({ name, ecoRating });
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

	// Create a map for quick lookup of eco ratings by player name (lowercase)
	const ecoRatingMap = React.useMemo(() => {
		const map: Record<string, number> = {};
		ecoRatings.forEach(player => {
			map[player.name.toLowerCase()] = player.ecoRating;
		});
		return map;
	}, [ecoRatings]);

	return {
		ecoRatings,
		ecoRatingMap,
		isLoading,
		error
	};
}
