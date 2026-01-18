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

// Extended player stats interface with all columns from the spreadsheet
export interface ExtendedPlayerStats {
	steam_id: string;
	name: string;
	tier: string;
	final_rating: number;
	games_count: number;
	rounds_played: number;
	rounds_won: number;
	rounds_lost: number;
	kills: number;
	assists: number;
	deaths: number;
	damage: number;
	opening_kills: number;
	adr: number;
	kpr: number;
	dpr: number;
	perfect_kills: number;
	trade_denials: number;
	traded_deaths: number;
	rounds_with_kill: number;
	rounds_with_multi_kill: number;
	kills_in_won_rounds: number;
	damage_in_won_rounds: number;
	awp_kills: number;
	awp_kills_per_round: number;
	rounds_with_awp_kill: number;
	awp_multi_kill_rounds: number;
	awp_opening_kills: number;
	multi_kills_1k: number;
	multi_kills_2k: number;
	multi_kills_3k: number;
	multi_kills_4k: number;
	multi_kills_5k: number;
	round_impact: number;
	survival: number;
	kast: number;
	econ_impact: number;
	eco_kill_value: number;
	eco_death_value: number;
	round_swing: number;
	clutch_rounds: number;
	clutch_wins: number;
	saved_by_teammate: number;
	saved_teammate: number;
	opening_deaths: number;
	opening_deaths_traded: number;
	support_rounds: number;
	assisted_kills: number;
	opening_attempts: number;
	opening_successes: number;
	rounds_won_after_opening: number;
	attack_rounds: number;
	clutch_1v1_attempts: number;
	clutch_1v1_wins: number;
	time_alive_per_round: number;
	last_alive_rounds: number;
	saves_on_loss: number;
	utility_damage: number;
	utility_kills: number;
	flashes_thrown: number;
	flash_assists: number;
	enemy_flash_duration_per_round: number;
	team_flash_count: number;
	team_flash_duration_per_round: number;
	exit_frags: number;
	awp_deaths: number;
	awp_deaths_no_kill: number;
	knife_kills: number;
	pistol_vs_rifle_kills: number;
	trade_kills: number;
	fast_trades: number;
	early_deaths: number;
	low_buy_kills: number;
	low_buy_kills_pct: number;
	disadvantaged_buy_kills: number;
	disadvantaged_buy_kills_pct: number;
	pistol_rounds_played: number;
	pistol_round_kills: number;
	pistol_round_deaths: number;
	pistol_round_damage: number;
	pistol_rounds_won: number;
	pistol_round_survivals: number;
	pistol_round_multi_kills: number;
	pistol_round_rating: number;
	t_rounds_played: number;
	t_kills: number;
	t_deaths: number;
	t_damage: number;
	t_survivals: number;
	t_rounds_with_multi_kill: number;
	t_eco_kill_value: number;
	t_round_swing: number;
	t_kast: number;
	t_clutch_rounds: number;
	t_clutch_wins: number;
	t_rating: number;
	t_eco_rating: number;
	ct_rounds_played: number;
	ct_kills: number;
	ct_deaths: number;
	ct_damage: number;
	ct_survivals: number;
	ct_rounds_with_multi_kill: number;
	ct_eco_kill_value: number;
	ct_round_swing: number;
	ct_kast: number;
	ct_clutch_rounds: number;
	ct_clutch_wins: number;
	ct_rating: number;
	ct_eco_rating: number;
	hltv_rating: number;
	rounds_with_kill_pct: number;
	kills_per_round_win: number;
	rounds_with_multi_kill_pct: number;
	damage_per_round_win: number;
	saved_by_teammate_per_round: number;
	traded_deaths_per_round: number;
	traded_deaths_pct: number;
	opening_deaths_traded_pct: number;
	assists_per_round: number;
	support_rounds_pct: number;
	saved_teammate_per_round: number;
	trade_kills_per_round: number;
	trade_kills_pct: number;
	assisted_kills_pct: number;
	damage_per_kill: number;
	opening_kills_per_round: number;
	opening_deaths_per_round: number;
	opening_attempts_pct: number;
	opening_success_pct: number;
	win_pct_after_opening_kill: number;
	attacks_per_round: number;
	clutch_points_per_round: number;
	last_alive_pct: number;
	clutch_1v1_win_pct: number;
	saves_per_round_loss: number;
	awp_kills_pct: number;
	rounds_with_awp_kill_pct: number;
	awp_multi_kill_rounds_per_round: number;
	awp_opening_kills_per_round: number;
	utility_damage_per_round: number;
	utility_kills_per_100_rounds: number;
	flashes_thrown_per_round: number;
	flash_assists_per_round: number;
	// Map-specific stats
	map_ratings: Record<MapName, number | undefined>;
	map_games_played: Record<MapName, number | undefined>;
}

// Define available extended stats for filtering/sorting with display labels
export const EXTENDED_STATS_COLUMNS: Array<{ key: keyof ExtendedPlayerStats; label: string; category: string }> = [
	// Core Stats
	{ key: "final_rating", label: "Rating", category: "Core" },
	{ key: "games_count", label: "Games", category: "Core" },
	{ key: "rounds_played", label: "Rounds", category: "Core" },
	{ key: "rounds_won", label: "Rounds Won", category: "Core" },
	{ key: "rounds_lost", label: "Rounds Lost", category: "Core" },
	{ key: "hltv_rating", label: "HLTV Rating", category: "Core" },
	
	// Combat Stats
	{ key: "kills", label: "Kills", category: "Combat" },
	{ key: "assists", label: "Assists", category: "Combat" },
	{ key: "deaths", label: "Deaths", category: "Combat" },
	{ key: "damage", label: "Damage", category: "Combat" },
	{ key: "adr", label: "ADR", category: "Combat" },
	{ key: "kpr", label: "KPR", category: "Combat" },
	{ key: "dpr", label: "DPR", category: "Combat" },
	{ key: "kast", label: "KAST", category: "Combat" },
	{ key: "survival", label: "Survival", category: "Combat" },
	
	// Opening Stats
	{ key: "opening_kills", label: "Opening Kills", category: "Opening" },
	{ key: "opening_deaths", label: "Opening Deaths", category: "Opening" },
	{ key: "opening_attempts", label: "Opening Attempts", category: "Opening" },
	{ key: "opening_successes", label: "Opening Successes", category: "Opening" },
	{ key: "opening_kills_per_round", label: "OK/Round", category: "Opening" },
	{ key: "opening_deaths_per_round", label: "OD/Round", category: "Opening" },
	{ key: "opening_attempts_pct", label: "Opening Attempts %", category: "Opening" },
	{ key: "opening_success_pct", label: "Opening Success %", category: "Opening" },
	{ key: "win_pct_after_opening_kill", label: "Win % After OK", category: "Opening" },
	
	// Multi-Kill Stats
	{ key: "rounds_with_kill", label: "Rounds w/ Kill", category: "Multi-Kill" },
	{ key: "rounds_with_multi_kill", label: "Rounds w/ Multi", category: "Multi-Kill" },
	{ key: "rounds_with_kill_pct", label: "Rounds w/ Kill %", category: "Multi-Kill" },
	{ key: "rounds_with_multi_kill_pct", label: "Rounds w/ Multi %", category: "Multi-Kill" },
	{ key: "multi_kills_2k", label: "2Ks", category: "Multi-Kill" },
	{ key: "multi_kills_3k", label: "3Ks", category: "Multi-Kill" },
	{ key: "multi_kills_4k", label: "4Ks", category: "Multi-Kill" },
	{ key: "multi_kills_5k", label: "5Ks (Aces)", category: "Multi-Kill" },
	{ key: "perfect_kills", label: "Perfect Kills", category: "Multi-Kill" },
	
	// Trade Stats
	{ key: "trade_kills", label: "Trade Kills", category: "Trading" },
	{ key: "trade_denials", label: "Trade Denials", category: "Trading" },
	{ key: "traded_deaths", label: "Traded Deaths", category: "Trading" },
	{ key: "fast_trades", label: "Fast Trades", category: "Trading" },
	{ key: "trade_kills_per_round", label: "Trades/Round", category: "Trading" },
	{ key: "trade_kills_pct", label: "Trade Kills %", category: "Trading" },
	{ key: "traded_deaths_pct", label: "Traded Deaths %", category: "Trading" },
	
	// Clutch Stats
	{ key: "clutch_rounds", label: "Clutch Rounds", category: "Clutch" },
	{ key: "clutch_wins", label: "Clutch Wins", category: "Clutch" },
	{ key: "clutch_1v1_attempts", label: "1v1 Attempts", category: "Clutch" },
	{ key: "clutch_1v1_wins", label: "1v1 Wins", category: "Clutch" },
	{ key: "clutch_1v1_win_pct", label: "1v1 Win %", category: "Clutch" },
	{ key: "clutch_points_per_round", label: "Clutch Pts/Round", category: "Clutch" },
	{ key: "last_alive_rounds", label: "Last Alive Rounds", category: "Clutch" },
	{ key: "last_alive_pct", label: "Last Alive %", category: "Clutch" },
	
	// AWP Stats
	{ key: "awp_kills", label: "AWP Kills", category: "AWP" },
	{ key: "awp_kills_per_round", label: "AWP Kills/Round", category: "AWP" },
	{ key: "awp_kills_pct", label: "AWP Kills %", category: "AWP" },
	{ key: "rounds_with_awp_kill", label: "Rounds w/ AWP Kill", category: "AWP" },
	{ key: "rounds_with_awp_kill_pct", label: "Rounds w/ AWP %", category: "AWP" },
	{ key: "awp_multi_kill_rounds", label: "AWP Multi Rounds", category: "AWP" },
	{ key: "awp_opening_kills", label: "AWP Opening Kills", category: "AWP" },
	{ key: "awp_deaths", label: "AWP Deaths", category: "AWP" },
	{ key: "awp_deaths_no_kill", label: "AWP Deaths (No Kill)", category: "AWP" },
	
	// Economy Stats
	{ key: "econ_impact", label: "Econ Impact", category: "Economy" },
	{ key: "eco_kill_value", label: "Eco Kill Value", category: "Economy" },
	{ key: "eco_death_value", label: "Eco Death Value", category: "Economy" },
	{ key: "round_swing", label: "Round Swing", category: "Economy" },
	{ key: "round_impact", label: "Round Impact", category: "Economy" },
	{ key: "low_buy_kills", label: "Low Buy Kills", category: "Economy" },
	{ key: "low_buy_kills_pct", label: "Low Buy Kills %", category: "Economy" },
	{ key: "disadvantaged_buy_kills", label: "Disadvantaged Kills", category: "Economy" },
	{ key: "disadvantaged_buy_kills_pct", label: "Disadvantaged Kills %", category: "Economy" },
	
	// Support Stats
	{ key: "support_rounds", label: "Support Rounds", category: "Support" },
	{ key: "support_rounds_pct", label: "Support Rounds %", category: "Support" },
	{ key: "assisted_kills", label: "Assisted Kills", category: "Support" },
	{ key: "assisted_kills_pct", label: "Assisted Kills %", category: "Support" },
	{ key: "assists_per_round", label: "Assists/Round", category: "Support" },
	{ key: "saved_teammate", label: "Saved Teammate", category: "Support" },
	{ key: "saved_teammate_per_round", label: "Saved Teammate/Round", category: "Support" },
	{ key: "saved_by_teammate", label: "Saved By Teammate", category: "Support" },
	{ key: "saved_by_teammate_per_round", label: "Saved By/Round", category: "Support" },
	
	// Utility Stats
	{ key: "utility_damage", label: "Utility Damage", category: "Utility" },
	{ key: "utility_damage_per_round", label: "Util Dmg/Round", category: "Utility" },
	{ key: "utility_kills", label: "Utility Kills", category: "Utility" },
	{ key: "utility_kills_per_100_rounds", label: "Util Kills/100 Rnds", category: "Utility" },
	{ key: "flashes_thrown", label: "Flashes Thrown", category: "Utility" },
	{ key: "flashes_thrown_per_round", label: "Flashes/Round", category: "Utility" },
	{ key: "flash_assists", label: "Flash Assists", category: "Utility" },
	{ key: "flash_assists_per_round", label: "Flash Assists/Round", category: "Utility" },
	{ key: "enemy_flash_duration_per_round", label: "Enemy Flash Dur/Round", category: "Utility" },
	{ key: "team_flash_count", label: "Team Flashes", category: "Utility" },
	{ key: "team_flash_duration_per_round", label: "Team Flash Dur/Round", category: "Utility" },
	
	// Pistol Stats
	{ key: "pistol_rounds_played", label: "Pistol Rounds", category: "Pistol" },
	{ key: "pistol_round_kills", label: "Pistol Kills", category: "Pistol" },
	{ key: "pistol_round_deaths", label: "Pistol Deaths", category: "Pistol" },
	{ key: "pistol_round_damage", label: "Pistol Damage", category: "Pistol" },
	{ key: "pistol_rounds_won", label: "Pistol Rounds Won", category: "Pistol" },
	{ key: "pistol_round_survivals", label: "Pistol Survivals", category: "Pistol" },
	{ key: "pistol_round_multi_kills", label: "Pistol Multi Kills", category: "Pistol" },
	{ key: "pistol_round_rating", label: "Pistol Rating", category: "Pistol" },
	
	// T-Side Stats
	{ key: "t_rounds_played", label: "T Rounds", category: "T-Side" },
	{ key: "t_kills", label: "T Kills", category: "T-Side" },
	{ key: "t_deaths", label: "T Deaths", category: "T-Side" },
	{ key: "t_damage", label: "T Damage", category: "T-Side" },
	{ key: "t_survivals", label: "T Survivals", category: "T-Side" },
	{ key: "t_kast", label: "T KAST", category: "T-Side" },
	{ key: "t_rating", label: "T Rating", category: "T-Side" },
	{ key: "t_eco_rating", label: "T Eco Rating", category: "T-Side" },
	
	// CT-Side Stats
	{ key: "ct_rounds_played", label: "CT Rounds", category: "CT-Side" },
	{ key: "ct_kills", label: "CT Kills", category: "CT-Side" },
	{ key: "ct_deaths", label: "CT Deaths", category: "CT-Side" },
	{ key: "ct_damage", label: "CT Damage", category: "CT-Side" },
	{ key: "ct_survivals", label: "CT Survivals", category: "CT-Side" },
	{ key: "ct_kast", label: "CT KAST", category: "CT-Side" },
	{ key: "ct_rating", label: "CT Rating", category: "CT-Side" },
	{ key: "ct_eco_rating", label: "CT Eco Rating", category: "CT-Side" },
	
	// Misc Stats
	{ key: "time_alive_per_round", label: "Time Alive/Round", category: "Misc" },
	{ key: "saves_on_loss", label: "Saves on Loss", category: "Misc" },
	{ key: "saves_per_round_loss", label: "Saves/Round Loss", category: "Misc" },
	{ key: "exit_frags", label: "Exit Frags", category: "Misc" },
	{ key: "early_deaths", label: "Early Deaths", category: "Misc" },
	{ key: "knife_kills", label: "Knife Kills", category: "Misc" },
	{ key: "pistol_vs_rifle_kills", label: "Pistol vs Rifle Kills", category: "Misc" },
	{ key: "damage_per_kill", label: "Damage/Kill", category: "Misc" },
	{ key: "kills_per_round_win", label: "Kills/Round Win", category: "Misc" },
	{ key: "damage_per_round_win", label: "Damage/Round Win", category: "Misc" },
	{ key: "kills_in_won_rounds", label: "Kills in Won Rounds", category: "Misc" },
	{ key: "damage_in_won_rounds", label: "Damage in Won Rounds", category: "Misc" },
	{ key: "attack_rounds", label: "Attack Rounds", category: "Misc" },
	{ key: "attacks_per_round", label: "Attacks/Round", category: "Misc" },
];

// Get unique categories
export const EXTENDED_STATS_CATEGORIES = [...new Set(EXTENDED_STATS_COLUMNS.map(c => c.category))];

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
	const headers = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
	
	// Create a map of header name to index
	const headerIndex: Record<string, number> = {};
	headers.forEach((h, i) => {
		headerIndex[h] = i;
	});
	
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
		
		const playerStats: ExtendedPlayerStats = {
			steam_id: getValue(values, "steam id"),
			name,
			tier: tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase(), // Capitalize tier name
			final_rating: getNumber(values, "final rating"),
			games_count: getNumber(values, "games"),
			rounds_played: getNumber(values, "rounds played"),
			rounds_won: getNumber(values, "rounds won"),
			rounds_lost: getNumber(values, "rounds lost"),
			kills: getNumber(values, "kills"),
			assists: getNumber(values, "assists"),
			deaths: getNumber(values, "deaths"),
			damage: getNumber(values, "damage"),
			opening_kills: getNumber(values, "opening kills"),
			adr: getNumber(values, "adr"),
			kpr: getNumber(values, "kpr"),
			dpr: getNumber(values, "dpr"),
			perfect_kills: getNumber(values, "perfect kills"),
			trade_denials: getNumber(values, "trade denials"),
			traded_deaths: getNumber(values, "traded deaths"),
			rounds_with_kill: getNumber(values, "rounds with kill"),
			rounds_with_multi_kill: getNumber(values, "rounds with multi kill"),
			kills_in_won_rounds: getNumber(values, "kills in won rounds"),
			damage_in_won_rounds: getNumber(values, "damage in won rounds"),
			awp_kills: getNumber(values, "awp kills"),
			awp_kills_per_round: getNumber(values, "awp kills per round"),
			rounds_with_awp_kill: getNumber(values, "rounds with awp kill"),
			awp_multi_kill_rounds: getNumber(values, "awp multi kill rounds"),
			awp_opening_kills: getNumber(values, "awp opening kills"),
			multi_kills_1k: getNumber(values, "1k"),
			multi_kills_2k: getNumber(values, "2k"),
			multi_kills_3k: getNumber(values, "3k"),
			multi_kills_4k: getNumber(values, "4k"),
			multi_kills_5k: getNumber(values, "5k"),
			round_impact: getNumber(values, "round impact"),
			survival: getNumber(values, "survival"),
			kast: getNumber(values, "kast"),
			econ_impact: getNumber(values, "econ impact"),
			eco_kill_value: getNumber(values, "eco kill value"),
			eco_death_value: getNumber(values, "eco death value"),
			round_swing: getNumber(values, "round swing"),
			clutch_rounds: getNumber(values, "clutch rounds"),
			clutch_wins: getNumber(values, "clutch wins"),
			saved_by_teammate: getNumber(values, "saved by teammate"),
			saved_teammate: getNumber(values, "saved teammate"),
			opening_deaths: getNumber(values, "opening deaths"),
			opening_deaths_traded: getNumber(values, "opening deaths traded"),
			support_rounds: getNumber(values, "support rounds"),
			assisted_kills: getNumber(values, "assisted kills"),
			opening_attempts: getNumber(values, "opening attempts"),
			opening_successes: getNumber(values, "opening successes"),
			rounds_won_after_opening: getNumber(values, "rounds won after opening"),
			attack_rounds: getNumber(values, "attack rounds"),
			clutch_1v1_attempts: getNumber(values, "clutch 1v1 attempts"),
			clutch_1v1_wins: getNumber(values, "clutch 1v1 wins"),
			time_alive_per_round: getNumber(values, "time alive per round"),
			last_alive_rounds: getNumber(values, "last alive rounds"),
			saves_on_loss: getNumber(values, "saves on loss"),
			utility_damage: getNumber(values, "utility damage"),
			utility_kills: getNumber(values, "utility kills"),
			flashes_thrown: getNumber(values, "flashes thrown"),
			flash_assists: getNumber(values, "flash assists"),
			enemy_flash_duration_per_round: getNumber(values, "enemy flash duration per round"),
			team_flash_count: getNumber(values, "team flash count"),
			team_flash_duration_per_round: getNumber(values, "team flash duration per round"),
			exit_frags: getNumber(values, "exit frags"),
			awp_deaths: getNumber(values, "awp deaths"),
			awp_deaths_no_kill: getNumber(values, "awp deaths no kill"),
			knife_kills: getNumber(values, "knife kills"),
			pistol_vs_rifle_kills: getNumber(values, "pistol vs rifle kills"),
			trade_kills: getNumber(values, "trade kills"),
			fast_trades: getNumber(values, "fast trades"),
			early_deaths: getNumber(values, "early deaths"),
			low_buy_kills: getNumber(values, "low buy kills"),
			low_buy_kills_pct: getNumber(values, "low buy kills pct"),
			disadvantaged_buy_kills: getNumber(values, "disadvantaged buy kills"),
			disadvantaged_buy_kills_pct: getNumber(values, "disadvantaged buy kills pct"),
			pistol_rounds_played: getNumber(values, "pistol rounds played"),
			pistol_round_kills: getNumber(values, "pistol round kills"),
			pistol_round_deaths: getNumber(values, "pistol round deaths"),
			pistol_round_damage: getNumber(values, "pistol round damage"),
			pistol_rounds_won: getNumber(values, "pistol rounds won"),
			pistol_round_survivals: getNumber(values, "pistol round survivals"),
			pistol_round_multi_kills: getNumber(values, "pistol round multi kills"),
			pistol_round_rating: getNumber(values, "pistol round rating"),
			t_rounds_played: getNumber(values, "t rounds played"),
			t_kills: getNumber(values, "t kills"),
			t_deaths: getNumber(values, "t deaths"),
			t_damage: getNumber(values, "t damage"),
			t_survivals: getNumber(values, "t survivals"),
			t_rounds_with_multi_kill: getNumber(values, "t rounds with multi kill"),
			t_eco_kill_value: getNumber(values, "t eco kill value"),
			t_round_swing: getNumber(values, "t round swing"),
			t_kast: getNumber(values, "t kast"),
			t_clutch_rounds: getNumber(values, "t clutch rounds"),
			t_clutch_wins: getNumber(values, "t clutch wins"),
			t_rating: getNumber(values, "t rating"),
			t_eco_rating: getNumber(values, "t eco rating"),
			ct_rounds_played: getNumber(values, "ct rounds played"),
			ct_kills: getNumber(values, "ct kills"),
			ct_deaths: getNumber(values, "ct deaths"),
			ct_damage: getNumber(values, "ct damage"),
			ct_survivals: getNumber(values, "ct survivals"),
			ct_rounds_with_multi_kill: getNumber(values, "ct rounds with multi kill"),
			ct_eco_kill_value: getNumber(values, "ct eco kill value"),
			ct_round_swing: getNumber(values, "ct round swing"),
			ct_kast: getNumber(values, "ct kast"),
			ct_clutch_rounds: getNumber(values, "ct clutch rounds"),
			ct_clutch_wins: getNumber(values, "ct clutch wins"),
			ct_rating: getNumber(values, "ct rating"),
			ct_eco_rating: getNumber(values, "ct eco rating"),
			hltv_rating: getNumber(values, "hltv rating"),
			rounds_with_kill_pct: getNumber(values, "rounds with kill pct"),
			kills_per_round_win: getNumber(values, "kills per round win"),
			rounds_with_multi_kill_pct: getNumber(values, "rounds with multi kill pct"),
			damage_per_round_win: getNumber(values, "damage per round win"),
			saved_by_teammate_per_round: getNumber(values, "saved by teammate per round"),
			traded_deaths_per_round: getNumber(values, "traded deaths per round"),
			traded_deaths_pct: getNumber(values, "traded deaths pct"),
			opening_deaths_traded_pct: getNumber(values, "opening deaths traded pct"),
			assists_per_round: getNumber(values, "assists per round"),
			support_rounds_pct: getNumber(values, "support rounds pct"),
			saved_teammate_per_round: getNumber(values, "saved teammate per round"),
			trade_kills_per_round: getNumber(values, "trade kills per round"),
			trade_kills_pct: getNumber(values, "trade kills pct"),
			assisted_kills_pct: getNumber(values, "assisted kills pct"),
			damage_per_kill: getNumber(values, "damage per kill"),
			opening_kills_per_round: getNumber(values, "opening kills per round"),
			opening_deaths_per_round: getNumber(values, "opening deaths per round"),
			opening_attempts_pct: getNumber(values, "opening attempts pct"),
			opening_success_pct: getNumber(values, "opening success pct"),
			win_pct_after_opening_kill: getNumber(values, "win pct after opening kill"),
			attacks_per_round: getNumber(values, "attacks per round"),
			clutch_points_per_round: getNumber(values, "clutch points per round"),
			last_alive_pct: getNumber(values, "last alive pct"),
			clutch_1v1_win_pct: getNumber(values, "clutch 1v1 win pct"),
			saves_per_round_loss: getNumber(values, "saves per round loss"),
			awp_kills_pct: getNumber(values, "awp kills pct"),
			rounds_with_awp_kill_pct: getNumber(values, "rounds with awp kill pct"),
			awp_multi_kill_rounds_per_round: getNumber(values, "awp multi kill rounds per round"),
			awp_opening_kills_per_round: getNumber(values, "awp opening kills per round"),
			utility_damage_per_round: getNumber(values, "utility damage per round"),
			utility_kills_per_100_rounds: getNumber(values, "utility kills per 100 rounds"),
			flashes_thrown_per_round: getNumber(values, "flashes thrown per round"),
			flash_assists_per_round: getNumber(values, "flash assists per round"),
			map_ratings,
			map_games_played,
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
		isLoading,
		error
	};
}
