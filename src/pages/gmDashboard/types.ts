import { CscStats } from "../../models/csc-stats-types";

export type PlayerTargets = Record<string, Record<string, number>>;
export type PlayerRoles = Record<string, string>;
export type PlayerRole = "IGL" | "AWPER" | "ENTRY" | "SUPPORT" | "RIFLER" | "LURKER";

export interface StatDefinition {
	key: keyof CscStats;
	label: string;
	description: string;
}

// Core stats used for target tracking in the GM dashboard
export const AVAILABLE_STATS: StatDefinition[] = [
	{ key: "rating", label: "Rating", description: "Overall player rating" },
	{ key: "kr", label: "K/R", description: "Kills per round" },
	{ key: "adr", label: "ADR", description: "Average damage per round" },
	{ key: "kast", label: "KAST", description: "Percentage of rounds with kill, assist, survived, or traded" },
	{ key: "impact", label: "Impact", description: "Impact rating" },
	{ key: "hs", label: "HS%", description: "Headshot percentage" },
	{ key: "clutchR", label: "Clutch", description: "Clutch success rate" },
	{ key: "awpR", label: "AWP K/R", description: "AWP kills per round" },
	{ key: "odr", label: "Opening Duel %", description: "Opening duel success rate" },
	{ key: "odaR", label: "OD Attempts/R", description: "Opening duel attempts per round" },
	{ key: "tradesR", label: "Trade K/R", description: "Trade kills per round" },
	{ key: "tRatio", label: "Traded %", description: "Deaths traded out percentage" },
	{ key: "suppR", label: "Support Rounds", description: "Support rounds percentage" },
	{ key: "suppXR", label: "Enemies Flashed/R", description: "Enemies flashed per round" },
	{ key: "util", label: "Utility Damage", description: "Utility damage per round" },
	{ key: "fAssists", label: "Flash Assists", description: "Flash assists per round" },
];

// Extended stats list for table view - includes all available stats
export const ALL_STATS: StatDefinition[] = [
	...AVAILABLE_STATS,
	{ key: "utilDmg", label: "Util Dmg", description: "Total utility damage" },
	{ key: "ef", label: "EF", description: "Enemies flashed" },
	{ key: "kills", label: "Kills", description: "Total kills" },
	{ key: "deaths", label: "Deaths", description: "Total deaths" },
	{ key: "assists", label: "Assists", description: "Total assists" },
	{ key: "gameCount", label: "Games", description: "Games played" },
	{ key: "rounds", label: "Rounds", description: "Rounds played" },
	{ key: "ctRating", label: "CT Rating", description: "CT side rating" },
	{ key: "TRating", label: "T Rating", description: "T side rating" },
	{ key: "consistency", label: "Consist.", description: "Consistency rating" },
	{ key: "form", label: "Form", description: "Recent form" },
	{ key: "peak", label: "Peak", description: "Peak rating" },
	{ key: "pit", label: "Pit", description: "Lowest rating" },
	{ key: "multiR", label: "Multi K/R", description: "Multi-kills per round" },
	{ key: "twoK", label: "2K", description: "Double kills" },
	{ key: "threeK", label: "3K", description: "Triple kills" },
	{ key: "fourK", label: "4K", description: "Quad kills" },
	{ key: "fiveK", label: "5K", description: "Aces" },
	{ key: "cl_1", label: "1v1", description: "1v1 clutches" },
	{ key: "cl_2", label: "1v2", description: "1v2 clutches" },
	{ key: "cl_3", label: "1v3", description: "1v3 clutches" },
	{ key: "cl_4", label: "1v4", description: "1v4 clutches" },
	{ key: "cl_5", label: "1v5", description: "1v5 clutches" },
	{ key: "saveRate", label: "Save %", description: "Save rate" },
	{ key: "savesR", label: "Saves/R", description: "Saves per round" },
	{ key: "adp", label: "ADP", description: "Average death placement" },
];

export const PLAYER_ROLES: PlayerRole[] = ["IGL", "AWPER", "ENTRY", "SUPPORT", "RIFLER", "LURKER"];
