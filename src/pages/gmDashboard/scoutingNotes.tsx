import * as React from "react";
import { Container } from "../../common/components/container";
import { Loading } from "../../common/components/loading";
import { useFetchFranchisesGraph } from "../../dao/franchisesGraphQLDao";
import { Franchise } from "../../models/franchise-types";
import { useLocalStorage } from "../../common/hooks/localStorage";
import { useStatsWithFallback } from "./hooks/useStatsWithFallback";
import { useCscPlayersCache } from "../../dao/cscPlayerGraphQLDao";
import { CscPlayer } from "../../models/csc-player-types";
import { franchiseImages } from "../../common/images/franchise";
import { CscStats } from "../../models/csc-stats-types";
import { GMSidebar } from "./components/GMSidebar";
import { PLAYER_ROLES, PlayerRole } from "./types";
import { handleExportSettings, createImportHandler, parseColorblindColors } from "./utils";

const getFranchiseImage = (prefix: string): string => {
	return franchiseImages[prefix] || "";
};

type Playstyle = "Aggressive" | "Passive";
type CommsRating = "Very Bad" | "Bad" | "Normal" | "Great" | "Excellent";

interface ScoutingNote {
	playerName: string;
	playstyle: Playstyle | "";
	role: PlayerRole | "";
	commsRating: CommsRating | "";
	notes: string;
}

const PLAYSTYLES: Playstyle[] = ["Aggressive", "Passive"];
const COMMS_RATINGS: CommsRating[] = ["Very Bad", "Bad", "Normal", "Great", "Excellent"];

export function ScoutingNotes() {
	const { data: franchises = [], isLoading } = useFetchFranchisesGraph();
	const [selectedFranchise, setSelectedFranchise] = useLocalStorage("franchise", "");
	const [searchQuery, setSearchQuery] = React.useState("");
	const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);
	const [scoutingNotes, setScoutingNotes] = useLocalStorage("scoutingNotes", "{}");
	const [playerTargets, setPlayerTargets] = useLocalStorage("playerTargets", "{}");
	const [selectedStats, setSelectedStats] = useLocalStorage("selectedTargetStats", '["rating"]');
	const [playerRoles, setPlayerRoles] = useLocalStorage("playerRoles", "{}");
	const [sectionOrder, setSectionOrder] = useLocalStorage("dashboardSectionOrder", "[]");
	const [hiddenSections, setHiddenSections] = useLocalStorage("dashboardHiddenSections", "[]");
	const [collapsedSections, setCollapsedSections] = useLocalStorage("dashboardCollapsedSections", "[]");
	const [colorblindMode, setColorblindMode] = useLocalStorage("colorblindMode", "false");
	const [colorblindColors, setColorblindColors] = useLocalStorage("colorblindColors", JSON.stringify({ good: "#22d3ee", warning: "#fb923c", bad: "#c084fc" }));
	const [showAddPlayerModal, setShowAddPlayerModal] = React.useState(false);
	const [playerSearchQuery, setPlayerSearchQuery] = React.useState("");
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const { 
		statsCache, 
		isLoading: isLoadingStats,
		isUsingFallback,
		currentSeason,
		effectiveSeason 
	} = useStatsWithFallback();
	const season = currentSeason;

	const { data: allPlayers = [] } = useCscPlayersCache(season, { enabled: season > 0 });

	// Parse scouting notes from localStorage
	const parsedScoutingNotes: Record<string, ScoutingNote[]> = React.useMemo(() => {
		try {
			return JSON.parse(scoutingNotes);
		} catch {
			return {};
		}
	}, [scoutingNotes]);

	// Get current franchise (match by prefix like dashboard does)
	const currentFranchise = franchises.find((f: Franchise) => f.prefix === selectedFranchise);

	// Get selected team
	const selectedTeam = React.useMemo(() => {
		if (!currentFranchise || !selectedTeamId) return null;
		return currentFranchise.teams.find(t => t.id === selectedTeamId) || null;
	}, [currentFranchise, selectedTeamId]);

	// Auto-select first team when franchise changes
	React.useEffect(() => {
		if (currentFranchise && currentFranchise.teams.length > 0) {
			// Check if current selectedTeamId is valid for this franchise
			const validTeam = currentFranchise.teams.find(t => t.id === selectedTeamId);
			if (!validTeam) {
				setSelectedTeamId(currentFranchise.teams[0].id);
			}
		}
	}, [currentFranchise, selectedTeamId]);

	// Get tier players for adding
	const tierPlayers: CscStats[] = React.useMemo(() => {
		if (!selectedTeam || !statsCache) return [];
		const tierStats = statsCache?.data?.[selectedTeam.tier.name as keyof typeof statsCache.data];
		return tierStats || [];
	}, [selectedTeam, statsCache]);

	// Get player MMR map
	const playerMmrMap = React.useMemo(() => {
		const map: Record<string, number> = {};
		allPlayers.forEach((player: CscPlayer) => {
			if (player.mmr) {
				map[player.name] = player.mmr;
			}
		});
		return map;
	}, [allPlayers]);

	// Get scouting notes for current team
	const currentTeamNotes = React.useMemo(() => {
		if (!selectedTeam) return [];
		const key = `${selectedTeam.tier.name}`;
		return parsedScoutingNotes[key] || [];
	}, [selectedTeam, parsedScoutingNotes]);

	// Filter players for add modal
	const filteredPlayersForAdd = React.useMemo(() => {
		if (!tierPlayers) return [];
		const existingNames = currentTeamNotes.map((n: ScoutingNote) => n.playerName);
		return tierPlayers
			.filter((p: CscStats) => !existingNames.includes(p.name))
			.filter((p: CscStats) => p.name.toLowerCase().includes(playerSearchQuery.toLowerCase()))
			.sort((a: CscStats, b: CscStats) => (b.rating || 0) - (a.rating || 0));
	}, [tierPlayers, currentTeamNotes, playerSearchQuery]);

	// Handle adding a player
	const handleAddPlayer = (playerName: string) => {
		if (!selectedTeam) return;
		const key = `${selectedTeam.tier.name}`;
		const newNote: ScoutingNote = {
			playerName,
			playstyle: "",
			role: "",
			commsRating: "",
			notes: ""
		};
		const updated = {
			...parsedScoutingNotes,
			[key]: [...(parsedScoutingNotes[key] || []), newNote]
		};
		setScoutingNotes(JSON.stringify(updated));
		setShowAddPlayerModal(false);
		setPlayerSearchQuery("");
	};

	// Handle updating a scouting note
	const handleUpdateNote = (playerName: string, field: keyof ScoutingNote, value: string) => {
		if (!selectedTeam) return;
		const key = `${selectedTeam.tier.name}`;
		const notes = parsedScoutingNotes[key] || [];
		const updated = notes.map(note => 
			note.playerName === playerName ? { ...note, [field]: value } : note
		);
		setScoutingNotes(JSON.stringify({
			...parsedScoutingNotes,
			[key]: updated
		}));
	};

	// Handle removing a player
	const handleRemovePlayer = (playerName: string) => {
		if (!selectedTeam) return;
		const key = `${selectedTeam.tier.name}`;
		const notes = parsedScoutingNotes[key] || [];
		const updated = notes.filter(note => note.playerName !== playerName);
		setScoutingNotes(JSON.stringify({
			...parsedScoutingNotes,
			[key]: updated
		}));
	};

	// Handle franchise selection (use prefix like dashboard does)
	const handleSelectFranchise = (franchise: Franchise) => {
		setSelectedFranchise(franchise.prefix);
		setSelectedTeamId(franchise.teams[0]?.id || null);
		setSearchQuery("");
	};

	// Filter franchises by search
	const filteredFranchises = React.useMemo(() => {
		if (!searchQuery) return franchises;
		return franchises.filter((f: Franchise) =>
			f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			f.prefix.toLowerCase().includes(searchQuery.toLowerCase())
		);
	}, [franchises, searchQuery]);

	// Export/Import handlers using shared utils
	const handleExport = () => {
		handleExportSettings(selectedFranchise, playerTargets, playerRoles, selectedStats, sectionOrder, hiddenSections, collapsedSections, scoutingNotes, colorblindMode, colorblindColors);
	};

	const handleFileChange = createImportHandler(
		setPlayerTargets,
		setPlayerRoles,
		setSelectedStats,
		setSelectedFranchise,
		setSectionOrder,
		setHiddenSections,
		setCollapsedSections,
		setScoutingNotes,
		setColorblindMode,
		setColorblindColors
	);

	if (isLoading) {
		return (
			<Container>
				<Loading />
			</Container>
		);
	}

	// Franchise selection screen
	if (!selectedFranchise) {
		return (
			<Container>
				<div className="py-8">
					<h1 className="text-3xl font-bold text-white mb-6">Select Your Franchise</h1>
					<div className="mb-4">
						<input
							type="text"
							placeholder="Search franchises..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
						/>
					</div>
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
						{filteredFranchises.map(franchise => (
							<button
								key={franchise.name}
								onClick={() => handleSelectFranchise(franchise)}
								className="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 hover:bg-gray-750 transition-all flex flex-col items-center gap-2"
							>
								<img
									src={getFranchiseImage(franchise.prefix)}
									alt={franchise.name}
									className="w-16 h-16 object-contain"
									onError={(e) => {
										(e.target as HTMLImageElement).style.display = 'none';
									}}
								/>
								<span className="text-white font-medium text-center text-sm">{franchise.name}</span>
								<span className="text-gray-400 text-xs">{franchise.prefix}</span>
							</button>
						))}
					</div>
				</div>
			</Container>
		);
	}

	return (
		<div className="flex min-h-screen bg-gray-900">
			{/* Sidebar */}
			<GMSidebar
				currentFranchise={currentFranchise}
				currentPage="scouting"
				onExport={handleExport}
				onImport={() => fileInputRef.current?.click()}
				onChangeFranchise={() => setSelectedFranchise("")}
				fileInputRef={fileInputRef}
				onFileChange={handleFileChange}
				colorblindMode={colorblindMode === "true"}
				onToggleColorblindMode={() => setColorblindMode(colorblindMode === "true" ? "false" : "true")}
				colorblindColors={parseColorblindColors(colorblindColors)}
				onColorblindColorsChange={(colors) => setColorblindColors(JSON.stringify(colors))}
			/>

			{/* Main Content */}
			<div className="flex-1 p-6">
				{isUsingFallback && (
					<div className="mb-4 p-3 bg-amber-900/50 border border-amber-600 rounded-lg flex items-center gap-2">
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
							<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
						</svg>
						<span className="text-amber-200 text-sm">
							<strong>Off-season:</strong> Showing Season {effectiveSeason} stats (current season has no stats yet)
						</span>
					</div>
				)}
				{/* Team Selector */}
				{currentFranchise && (
					<div className="mb-6">
						<div className="flex gap-2 flex-wrap">
							{currentFranchise.teams.map(team => (
								<button
									key={team.id}
									onClick={() => setSelectedTeamId(team.id)}
									className={`px-4 py-2 rounded-lg font-medium transition-colors ${
										selectedTeamId === team.id
											? "bg-blue-600 text-white"
											: "bg-gray-800 text-gray-300 hover:bg-gray-700"
									}`}
								>
									{team.name} ({team.tier.name})
								</button>
							))}
						</div>
					</div>
				)}

				{/* Scouting Notes Content */}
				{!selectedTeam && currentFranchise && (
					<div className="text-center py-8 text-gray-400">
						Select a team to view scouting notes
					</div>
				)}
				{selectedTeam && (
					<div className="bg-gray-800 rounded-lg border border-gray-700">
						<div className="p-4 border-b border-gray-700 flex justify-between items-center">
							<h2 className="text-xl font-bold text-white">
								Scouting Notes - {selectedTeam.tier.name}
							</h2>
							<button
								onClick={() => setShowAddPlayerModal(true)}
								className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
							>
								<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
									<path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
								</svg>
								Add Player
							</button>
						</div>

						{/* Player Cards */}
						<div className="p-4 space-y-4">
							{currentTeamNotes.length === 0 ? (
								<div className="text-center py-8 text-gray-400">
									No scouting notes yet. Click "Add Player" to start scouting.
								</div>
							) : (
								currentTeamNotes.map(note => {
									const playerStats = tierPlayers.find(p => p.name === note.playerName);
									const playerMmr = playerMmrMap[note.playerName];
									
									return (
										<div key={note.playerName} className="bg-gray-750 rounded-lg border border-gray-600 p-4">
											<div className="flex justify-between items-start mb-4">
												<div>
													<h3 className="text-lg font-bold text-white">{note.playerName}</h3>
													<div className="flex gap-4 text-sm text-gray-400">
														<span>MMR: {playerMmr || "N/A"}</span>
														<span>Rating: {playerStats?.rating?.toFixed(2) || "N/A"}</span>
														<span>ADR: {playerStats?.adr?.toFixed(1) || "N/A"}</span>
														<span>Team: {playerStats?.team || "FA"}</span>
													</div>
												</div>
												<button
													onClick={() => handleRemovePlayer(note.playerName)}
													className="text-gray-500 hover:text-red-400 transition-colors"
													title="Remove player"
												>
													<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
														<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
													</svg>
												</button>
											</div>

											<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
												{/* Playstyle Dropdown */}
												<div>
													<label className="block text-sm font-medium text-gray-400 mb-1">Playstyle</label>
													<select
														value={note.playstyle}
														onChange={(e) => handleUpdateNote(note.playerName, "playstyle", e.target.value)}
														className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
													>
														<option value="">Select...</option>
														{PLAYSTYLES.map(style => (
															<option key={style} value={style}>{style}</option>
														))}
													</select>
												</div>

												{/* Role Dropdown */}
												<div>
													<label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
													<select
														value={note.role}
														onChange={(e) => handleUpdateNote(note.playerName, "role", e.target.value)}
														className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
													>
														<option value="">Select...</option>
														{PLAYER_ROLES.map(role => (
															<option key={role} value={role}>{role}</option>
														))}
													</select>
												</div>

												{/* Comms Rating Dropdown */}
												<div>
													<label className="block text-sm font-medium text-gray-400 mb-1">Comms Rating</label>
													<select
														value={note.commsRating}
														onChange={(e) => handleUpdateNote(note.playerName, "commsRating", e.target.value)}
														className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
													>
														<option value="">Select...</option>
														{COMMS_RATINGS.map(rating => (
															<option key={rating} value={rating}>{rating}</option>
														))}
													</select>
												</div>
											</div>

											{/* Notes Textarea */}
											<div>
												<label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
												<textarea
													value={note.notes}
													onChange={(e) => handleUpdateNote(note.playerName, "notes", e.target.value)}
													placeholder="Add your scouting notes here..."
													rows={3}
													className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
												/>
											</div>
										</div>
									);
								})
							)}
						</div>
					</div>
				)}
			</div>

			{/* Add Player Modal */}
			{showAddPlayerModal && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowAddPlayerModal(false)}>
					<div 
						className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-lg max-h-[80vh] overflow-hidden"
						onClick={e => e.stopPropagation()}
					>
						<div className="p-4 border-b border-gray-700">
							<div className="flex justify-between items-center mb-3">
								<h3 className="text-lg font-bold text-white">Add Player to Scout</h3>
								<button
									onClick={() => setShowAddPlayerModal(false)}
									className="text-gray-400 hover:text-white transition-colors"
								>
									<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
										<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
									</svg>
								</button>
							</div>
							<input
								type="text"
								placeholder="Search players..."
								value={playerSearchQuery}
								onChange={(e) => setPlayerSearchQuery(e.target.value)}
								className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
								autoFocus
							/>
						</div>
						<div className="max-h-96 overflow-y-auto">
							{filteredPlayersForAdd.length === 0 ? (
								<div className="p-4 text-center text-gray-400">
									No players found
								</div>
							) : (
								<div className="divide-y divide-gray-700">
									{filteredPlayersForAdd.slice(0, 50).map(player => (
										<button
											key={player.name}
											onClick={() => handleAddPlayer(player.name)}
											className="w-full px-4 py-3 text-left hover:bg-gray-750 transition-colors flex justify-between items-center"
										>
											<div>
												<span className="text-white font-medium">{player.name}</span>
												<span className="text-gray-500 text-sm ml-2">({player.team || "FA"})</span>
											</div>
											<div className="text-sm text-gray-400">
												<span className="mr-3">MMR: {playerMmrMap[player.name] || "N/A"}</span>
												<span>Rating: {player.rating?.toFixed(2) || "N/A"}</span>
											</div>
										</button>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Hidden file input for import */}
			<input
				ref={fileInputRef}
				type="file"
				accept=".json"
				onChange={handleFileChange}
				className="hidden"
			/>
		</div>
	);
}
