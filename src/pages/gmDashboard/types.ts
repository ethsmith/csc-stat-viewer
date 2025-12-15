import { CscStats } from "../../models/csc-stats-types";

export type PlayerTargets = Record<string, Record<string, number>>;
export type PlayerRoles = Record<string, string>;
export type PlayerRole = "IGL" | "AWPER" | "ENTRY" | "SUPPORT" | "RIFLER" | "LURKER";

export const AVAILABLE_STATS: { key: keyof CscStats; label: string; description: string }[] = [
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

export const PLAYER_ROLES: PlayerRole[] = ["IGL", "AWPER", "ENTRY", "SUPPORT", "RIFLER", "LURKER"];
