import { useQuery } from "@tanstack/react-query";
import * as React from "react";

// Normalize player name for consistent lookups: lowercase, trim, remove extra whitespace
export const normalizeName = (name: string): string => {
	return name.toLowerCase().trim().replace(/\s+/g, " ");
};

// Google Sheets configuration for draft status
// https://docs.google.com/spreadsheets/d/1nsScfN6MEoVs9QZP7YxwivSu2wZcgLRBlEKQ7Q3dP4Q/edit?usp=sharing
const SPREADSHEET_ID = "1nsScfN6MEoVs9QZP7YxwivSu2wZcgLRBlEKQ7Q3dP4Q";
const SHEET_NAME = "Sheet1";

interface DraftedPlayer {
	name: string;
	drafted: boolean;
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

// Fetch and parse draft status from Google Sheets
const fetchDraftStatus = async (): Promise<DraftedPlayer[]> => {
	const encodedSheetName = encodeURIComponent(SHEET_NAME);
	const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodedSheetName}`;
	
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch draft status from Google Sheets");
	}
	
	const csvText = await response.text();
	const lines = csvText.split("\n");
	
	// Parse CSV - first line is headers
	const players: DraftedPlayer[] = [];
	
	// Find column indices from header row
	const headerLine = lines[0];
	const headers = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
	
	// Look for name column with various possible headers
	const nameIndex = headers.findIndex(h => 
		h === "name" || h === "player" || h === "player name" || h === "playername"
	);
	// Look for drafted column with various possible headers
	const draftedIndex = headers.findIndex(h => 
		h === "drafted?" || h === "drafted" || h === "is drafted" || h === "isdrafted"
	);
	
	if (nameIndex === -1) {
		console.error("Could not find 'Name' column in spreadsheet. Headers found:", headers);
		return [];
	}
	
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		
		// Parse CSV line (handle quoted values)
		const values = parseCSVLine(line);
		
		if (values.length > nameIndex) {
			const name = values[nameIndex].replace(/^"|"$/g, "").trim();
			
			// Get drafted status - default to false if column not found
			let drafted = false;
			if (draftedIndex !== -1 && values.length > draftedIndex) {
				const draftedValue = values[draftedIndex].replace(/^"|"$/g, "").trim().toUpperCase();
				drafted = draftedValue === "TRUE" || draftedValue === "YES" || draftedValue === "✓" || draftedValue === "X";
			}
			
			if (name) {
				players.push({ name, drafted });
			}
		}
	}
	
	return players;
};

interface UseDraftStatusOptions {
	autoRefresh?: boolean;
	refetchInterval?: number;
}

/**
 * Hook to fetch draft status from Google Sheets and provide a lookup map
 */
export function useDraftStatus(options: UseDraftStatusOptions = {}) {
	const { autoRefresh = true, refetchInterval = 2000 } = options;

	const { 
		data: draftStatus = [],
		isLoading,
		refetch,
		dataUpdatedAt,
		error
	} = useQuery({
		queryKey: ["draftStatus", SPREADSHEET_ID],
		queryFn: fetchDraftStatus,
		refetchInterval: autoRefresh ? refetchInterval : false,
		staleTime: 5000,
	});

	const draftStatusMap = React.useMemo(() => {
		const map: Record<string, boolean> = {};
		draftStatus.forEach(player => {
			map[normalizeName(player.name)] = player.drafted;
		});
		return map;
	}, [draftStatus]);

	return {
		draftStatus,
		draftStatusMap,
		isLoading,
		refetch,
		dataUpdatedAt,
		error
	};
}
