import * as React from "react";
import { CscStats } from "../../../models/csc-stats-types";
import { CscPlayer } from "../../../models/csc-player-types";
import { getPositiveColor, getNegativeColor, getPlayerTeamDisplay } from "../utils";

export interface ComparisonPlayerData {
	stats: CscStats;
	mmr: number | undefined;
}

interface PlayerComparisonModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSelectPlayer: (playerData: ComparisonPlayerData) => void;
	currentPlayerName: string;
	currentPlayerMmr: number | undefined;
	tierName: string;
	availablePlayers: CscStats[];
	rosteredPlayerNames: string[];
	alreadyComparedNames: string[];
	alreadySelectedForSigning: string[];
	playerMmrMap: Record<string, number>;
	teamMmrCap: number;
	teamCurrentMmr: number;
	selectedSigningsMmrDelta: number;
	playersData?: CscPlayer[];
}

export function PlayerComparisonModal({
	isOpen,
	onClose,
	onSelectPlayer,
	currentPlayerName,
	currentPlayerMmr,
	tierName,
	availablePlayers,
	rosteredPlayerNames,
	alreadyComparedNames,
	alreadySelectedForSigning,
	playerMmrMap,
	teamMmrCap,
	teamCurrentMmr,
	selectedSigningsMmrDelta,
	playersData
}: PlayerComparisonModalProps) {
	const [searchQuery, setSearchQuery] = React.useState("");

	// Filter out rostered players, already compared players, and filter by search
	// Mark players already selected for signing in other pools
	const filteredPlayers = React.useMemo(() => {
		return availablePlayers
			.filter(player => !rosteredPlayerNames.includes(player.name))
			.filter(player => !alreadyComparedNames.includes(player.name))
			.filter(player => 
				player.name.toLowerCase().includes(searchQuery.toLowerCase())
			)
			.sort((a, b) => (b.rating || 0) - (a.rating || 0));
	}, [availablePlayers, rosteredPlayerNames, alreadyComparedNames, searchQuery]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
			<div 
				className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[80vh] overflow-hidden"
				onClick={e => e.stopPropagation()}
			>
				<div className="p-4 border-b border-gray-700">
					<div className="flex justify-between items-center mb-3">
						<h3 className="text-lg font-bold text-white">
							Compare with {currentPlayerName}
						</h3>
						<button
							onClick={onClose}
							className="text-gray-400 hover:text-white transition-colors"
						>
							<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
								<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
							</svg>
						</button>
					</div>
					<p className="text-sm text-gray-400 mb-3">
						Select a player from {tierName} to compare stats
					</p>
					<input
						type="text"
						placeholder="Search players..."
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
						className="w-full px-3 py-2 bg-gray-900 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
						autoFocus
					/>
				</div>
				
				<div className="overflow-y-auto max-h-[60vh]">
					{filteredPlayers.length === 0 ? (
						<div className="p-8 text-center text-gray-400">
							No players found
						</div>
					) : (
						<table className="w-full">
							<thead className="bg-gray-900 sticky top-0">
								<tr>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">MMR</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Rating</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">ADR</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">MMR After</th>
									<th className="px-4 py-2"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-700">
								{filteredPlayers.map(player => {
									const playerMmr = playerMmrMap[player.name];
									const isAlreadySelected = alreadySelectedForSigning.includes(player.name);
									
									// MMR calculation includes all currently selected signings + this potential swap
									const mmrAfterSwap = currentPlayerMmr && playerMmr 
										? teamCurrentMmr + selectedSigningsMmrDelta - currentPlayerMmr + playerMmr
										: undefined;
									const mmrRemaining = mmrAfterSwap !== undefined ? teamMmrCap - mmrAfterSwap : undefined;
									const isOverCap = mmrRemaining !== undefined && mmrRemaining < 0;
									
									return (
										<tr 
											key={player.name} 
											className={`hover:bg-gray-750 cursor-pointer ${isOverCap || isAlreadySelected ? 'opacity-50' : ''}`}
											onClick={() => !isAlreadySelected && onSelectPlayer({ stats: player, mmr: playerMmr })}
										>
											<td className="px-4 py-3 text-sm font-medium text-white">
												{player.name}
												{isAlreadySelected && <span className="ml-2 text-xs text-yellow-400">(selected elsewhere)</span>}
											</td>
											<td className="px-4 py-3 text-sm text-gray-400">
												{getPlayerTeamDisplay(player.name, player.team, playersData)}
											</td>
											<td className="px-4 py-3 text-sm text-gray-300">
												{playerMmr || "N/A"}
											</td>
											<td className="px-4 py-3 text-sm text-gray-300">
												{player.rating?.toFixed(2) || "N/A"}
											</td>
											<td className="px-4 py-3 text-sm text-gray-300">
												{player.adr?.toFixed(1) || "N/A"}
											</td>
											<td className="px-4 py-3 text-sm">
												{mmrRemaining !== undefined ? (
													<span className={isOverCap ? 'text-red-400 font-semibold' : 'text-green-400'}>
														{mmrRemaining} left
													</span>
												) : (
													<span className="text-gray-500">N/A</span>
												)}
											</td>
											<td className="px-4 py-3">
												<button
													onClick={(e) => {
														e.stopPropagation();
														if (!isAlreadySelected) onSelectPlayer({ stats: player, mmr: playerMmr });
													}}
													disabled={isAlreadySelected}
													className={`px-3 py-1 text-xs rounded transition-colors ${isAlreadySelected ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
												>
													{isAlreadySelected ? 'Taken' : 'Compare'}
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					)}
				</div>
			</div>
		</div>
	);
}

interface StatComparisonBadgeProps {
	currentValue: number | undefined;
	comparisonValue: number | undefined;
	statKey: string;
	inverse?: boolean; // For stats where lower is better
	colorblindMode?: boolean;
}

export function StatComparisonBadge({ 
	currentValue, 
	comparisonValue, 
	statKey,
	inverse = false,
	colorblindMode = false
}: StatComparisonBadgeProps) {
	if (currentValue === undefined || comparisonValue === undefined) {
		return null;
	}

	const diff = comparisonValue - currentValue;
	const percentDiff = currentValue !== 0 ? (diff / Math.abs(currentValue)) * 100 : 0;
	
	// Determine if this is better or worse
	let isBetter = diff > 0;
	if (inverse) isBetter = !isBetter;
	
	// Don't show badge for negligible differences
	if (Math.abs(percentDiff) < 0.5) {
		return (
			<span className="ml-1 text-xs text-gray-500">
				(=)
			</span>
		);
	}

	const colorClass = isBetter ? getPositiveColor(colorblindMode) : getNegativeColor(colorblindMode);
	const sign = diff > 0 ? "+" : "";

	return (
		<span className={`ml-1 text-xs font-semibold ${colorClass}`}>
			({sign}{percentDiff.toFixed(1)}%)
		</span>
	);
}
