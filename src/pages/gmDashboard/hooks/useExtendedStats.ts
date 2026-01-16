import { useQuery } from "@tanstack/react-query";
import * as React from "react";

// Extended stats spreadsheet configuration (same spreadsheet as eco ratings)
const EXTENDED_STATS_SPREADSHEET_ID = "1lcZ80NLIG2vLQvS7G3zL8tPcc6_iV24PG_V-ZmZNWHo";
const EXTENDED_STATS_SHEET_NAME = "ratings";

// Map names from the spreadsheet
const MAP_NAMES = ["de_nuke", "de_anubis", "de_dust2", "de_inferno", "de_overpass", "de_ancient", "de_mirage", "de_train"] as const;
export type MapName = typeof MAP_NAMES[number];

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
			const ratingVal = getValue(values, `map_ratings/${mapName}`);
			const gamesVal = getValue(values, `map_games_played/${mapName}`);
			
			map_ratings[mapName] = ratingVal ? parseFloat(ratingVal) : undefined;
			map_games_played[mapName] = gamesVal ? parseInt(gamesVal, 10) : undefined;
		});
		
		const playerStats: ExtendedPlayerStats = {
			steam_id: getValue(values, "steam_id"),
			name,
			tier: tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase(), // Capitalize tier name
			final_rating: getNumber(values, "final_rating"),
			games_count: getNumber(values, "games_count"),
			rounds_played: getNumber(values, "rounds_played"),
			rounds_won: getNumber(values, "rounds_won"),
			rounds_lost: getNumber(values, "rounds_lost"),
			kills: getNumber(values, "kills"),
			assists: getNumber(values, "assists"),
			deaths: getNumber(values, "deaths"),
			damage: getNumber(values, "damage"),
			opening_kills: getNumber(values, "opening_kills"),
			adr: getNumber(values, "adr"),
			kpr: getNumber(values, "kpr"),
			dpr: getNumber(values, "dpr"),
			perfect_kills: getNumber(values, "perfect_kills"),
			trade_denials: getNumber(values, "trade_denials"),
			traded_deaths: getNumber(values, "traded_deaths"),
			rounds_with_kill: getNumber(values, "rounds_with_kill"),
			rounds_with_multi_kill: getNumber(values, "rounds_with_multi_kill"),
			kills_in_won_rounds: getNumber(values, "kills_in_won_rounds"),
			damage_in_won_rounds: getNumber(values, "damage_in_won_rounds"),
			awp_kills: getNumber(values, "awp_kills"),
			awp_kills_per_round: getNumber(values, "awp_kills_per_round"),
			rounds_with_awp_kill: getNumber(values, "rounds_with_awp_kill"),
			awp_multi_kill_rounds: getNumber(values, "awp_multi_kill_rounds"),
			awp_opening_kills: getNumber(values, "awp_opening_kills"),
			multi_kills_1k: getNumber(values, "multi_kills/1k"),
			multi_kills_2k: getNumber(values, "multi_kills/2k"),
			multi_kills_3k: getNumber(values, "multi_kills/3k"),
			multi_kills_4k: getNumber(values, "multi_kills/4k"),
			multi_kills_5k: getNumber(values, "multi_kills/5k"),
			round_impact: getNumber(values, "round_impact"),
			survival: getNumber(values, "survival"),
			kast: getNumber(values, "kast"),
			econ_impact: getNumber(values, "econ_impact"),
			eco_kill_value: getNumber(values, "eco_kill_value"),
			eco_death_value: getNumber(values, "eco_death_value"),
			round_swing: getNumber(values, "round_swing"),
			clutch_rounds: getNumber(values, "clutch_rounds"),
			clutch_wins: getNumber(values, "clutch_wins"),
			saved_by_teammate: getNumber(values, "saved_by_teammate"),
			saved_teammate: getNumber(values, "saved_teammate"),
			opening_deaths: getNumber(values, "opening_deaths"),
			opening_deaths_traded: getNumber(values, "opening_deaths_traded"),
			support_rounds: getNumber(values, "support_rounds"),
			assisted_kills: getNumber(values, "assisted_kills"),
			opening_attempts: getNumber(values, "opening_attempts"),
			opening_successes: getNumber(values, "opening_successes"),
			rounds_won_after_opening: getNumber(values, "rounds_won_after_opening"),
			attack_rounds: getNumber(values, "attack_rounds"),
			clutch_1v1_attempts: getNumber(values, "clutch_1v1_attempts"),
			clutch_1v1_wins: getNumber(values, "clutch_1v1_wins"),
			time_alive_per_round: getNumber(values, "time_alive_per_round"),
			last_alive_rounds: getNumber(values, "last_alive_rounds"),
			saves_on_loss: getNumber(values, "saves_on_loss"),
			utility_damage: getNumber(values, "utility_damage"),
			utility_kills: getNumber(values, "utility_kills"),
			flashes_thrown: getNumber(values, "flashes_thrown"),
			flash_assists: getNumber(values, "flash_assists"),
			enemy_flash_duration_per_round: getNumber(values, "enemy_flash_duration_per_round"),
			team_flash_count: getNumber(values, "team_flash_count"),
			team_flash_duration_per_round: getNumber(values, "team_flash_duration_per_round"),
			exit_frags: getNumber(values, "exit_frags"),
			awp_deaths: getNumber(values, "awp_deaths"),
			awp_deaths_no_kill: getNumber(values, "awp_deaths_no_kill"),
			knife_kills: getNumber(values, "knife_kills"),
			pistol_vs_rifle_kills: getNumber(values, "pistol_vs_rifle_kills"),
			trade_kills: getNumber(values, "trade_kills"),
			fast_trades: getNumber(values, "fast_trades"),
			early_deaths: getNumber(values, "early_deaths"),
			low_buy_kills: getNumber(values, "low_buy_kills"),
			low_buy_kills_pct: getNumber(values, "low_buy_kills_pct"),
			disadvantaged_buy_kills: getNumber(values, "disadvantaged_buy_kills"),
			disadvantaged_buy_kills_pct: getNumber(values, "disadvantaged_buy_kills_pct"),
			pistol_rounds_played: getNumber(values, "pistol_rounds_played"),
			pistol_round_kills: getNumber(values, "pistol_round_kills"),
			pistol_round_deaths: getNumber(values, "pistol_round_deaths"),
			pistol_round_damage: getNumber(values, "pistol_round_damage"),
			pistol_rounds_won: getNumber(values, "pistol_rounds_won"),
			pistol_round_survivals: getNumber(values, "pistol_round_survivals"),
			pistol_round_multi_kills: getNumber(values, "pistol_round_multi_kills"),
			pistol_round_rating: getNumber(values, "pistol_round_rating"),
			t_rounds_played: getNumber(values, "t_rounds_played"),
			t_kills: getNumber(values, "t_kills"),
			t_deaths: getNumber(values, "t_deaths"),
			t_damage: getNumber(values, "t_damage"),
			t_survivals: getNumber(values, "t_survivals"),
			t_rounds_with_multi_kill: getNumber(values, "t_rounds_with_multi_kill"),
			t_eco_kill_value: getNumber(values, "t_eco_kill_value"),
			t_round_swing: getNumber(values, "t_round_swing"),
			t_kast: getNumber(values, "t_kast"),
			t_clutch_rounds: getNumber(values, "t_clutch_rounds"),
			t_clutch_wins: getNumber(values, "t_clutch_wins"),
			t_rating: getNumber(values, "t_rating"),
			t_eco_rating: getNumber(values, "t_eco_rating"),
			ct_rounds_played: getNumber(values, "ct_rounds_played"),
			ct_kills: getNumber(values, "ct_kills"),
			ct_deaths: getNumber(values, "ct_deaths"),
			ct_damage: getNumber(values, "ct_damage"),
			ct_survivals: getNumber(values, "ct_survivals"),
			ct_rounds_with_multi_kill: getNumber(values, "ct_rounds_with_multi_kill"),
			ct_eco_kill_value: getNumber(values, "ct_eco_kill_value"),
			ct_round_swing: getNumber(values, "ct_round_swing"),
			ct_kast: getNumber(values, "ct_kast"),
			ct_clutch_rounds: getNumber(values, "ct_clutch_rounds"),
			ct_clutch_wins: getNumber(values, "ct_clutch_wins"),
			ct_rating: getNumber(values, "ct_rating"),
			ct_eco_rating: getNumber(values, "ct_eco_rating"),
			hltv_rating: getNumber(values, "hltv_rating"),
			rounds_with_kill_pct: getNumber(values, "rounds_with_kill_pct"),
			kills_per_round_win: getNumber(values, "kills_per_round_win"),
			rounds_with_multi_kill_pct: getNumber(values, "rounds_with_multi_kill_pct"),
			damage_per_round_win: getNumber(values, "damage_per_round_win"),
			saved_by_teammate_per_round: getNumber(values, "saved_by_teammate_per_round"),
			traded_deaths_per_round: getNumber(values, "traded_deaths_per_round"),
			traded_deaths_pct: getNumber(values, "traded_deaths_pct"),
			opening_deaths_traded_pct: getNumber(values, "opening_deaths_traded_pct"),
			assists_per_round: getNumber(values, "assists_per_round"),
			support_rounds_pct: getNumber(values, "support_rounds_pct"),
			saved_teammate_per_round: getNumber(values, "saved_teammate_per_round"),
			trade_kills_per_round: getNumber(values, "trade_kills_per_round"),
			trade_kills_pct: getNumber(values, "trade_kills_pct"),
			assisted_kills_pct: getNumber(values, "assisted_kills_pct"),
			damage_per_kill: getNumber(values, "damage_per_kill"),
			opening_kills_per_round: getNumber(values, "opening_kills_per_round"),
			opening_deaths_per_round: getNumber(values, "opening_deaths_per_round"),
			opening_attempts_pct: getNumber(values, "opening_attempts_pct"),
			opening_success_pct: getNumber(values, "opening_success_pct"),
			win_pct_after_opening_kill: getNumber(values, "win_pct_after_opening_kill"),
			attacks_per_round: getNumber(values, "attacks_per_round"),
			clutch_points_per_round: getNumber(values, "clutch_points_per_round"),
			last_alive_pct: getNumber(values, "last_alive_pct"),
			clutch_1v1_win_pct: getNumber(values, "clutch_1v1_win_pct"),
			saves_per_round_loss: getNumber(values, "saves_per_round_loss"),
			awp_kills_pct: getNumber(values, "awp_kills_pct"),
			rounds_with_awp_kill_pct: getNumber(values, "rounds_with_awp_kill_pct"),
			awp_multi_kill_rounds_per_round: getNumber(values, "awp_multi_kill_rounds_per_round"),
			awp_opening_kills_per_round: getNumber(values, "awp_opening_kills_per_round"),
			utility_damage_per_round: getNumber(values, "utility_damage_per_round"),
			utility_kills_per_100_rounds: getNumber(values, "utility_kills_per_100_rounds"),
			flashes_thrown_per_round: getNumber(values, "flashes_thrown_per_round"),
			flash_assists_per_round: getNumber(values, "flash_assists_per_round"),
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
