import * as React from "react";
import { Link } from "wouter";
import { Franchise } from "../../../models/franchise-types";
import { franchiseImages } from "../../../common/images/franchise";
import { ColorblindColors, DEFAULT_COLORBLIND_COLORS } from "../utils";

interface GMSidebarProps {
	currentFranchise: Franchise | undefined;
	currentPage: "dashboard" | "targets" | "scouting" | "tableview" | "draftlist" | "teamvisualizer";
	onExport: () => void;
	onImport: () => void;
	onChangeFranchise: () => void;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	colorblindMode?: boolean;
	onToggleColorblindMode?: () => void;
	colorblindColors?: ColorblindColors;
	onColorblindColorsChange?: (colors: ColorblindColors) => void;
}

const getFranchiseImage = (prefix: string): string => {
	return franchiseImages[prefix] || "";
};

export function GMSidebar({
	currentFranchise,
	currentPage,
	onExport,
	onImport,
	onChangeFranchise,
	fileInputRef,
	onFileChange,
	colorblindMode,
	onToggleColorblindMode,
	colorblindColors = DEFAULT_COLORBLIND_COLORS,
	onColorblindColorsChange
}: GMSidebarProps) {
	return (
		<div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
			{/* Franchise Header */}
			<div className="p-6 border-b border-gray-700">
				<div className="flex items-center gap-3 mb-2">
					{currentFranchise && (
						<img
							src={getFranchiseImage(currentFranchise.prefix)}
							alt={currentFranchise.name}
							className="w-12 h-12 object-contain"
							onError={(e) => {
								(e.target as HTMLImageElement).style.display = 'none';
							}}
						/>
					)}
					<div className="flex-1">
						<h3 className="font-bold text-white text-sm">GM Dashboard</h3>
						{currentFranchise && (
							<p className="text-xs text-gray-400 truncate">{currentFranchise.name}</p>
						)}
					</div>
				</div>
			</div>

			{/* Navigation */}
			<nav className="flex-1 p-4 space-y-2">
				<Link href="/dashboard">
					<button className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
						currentPage === "dashboard"
							? "text-white bg-blue-600 hover:bg-blue-500"
							: "text-gray-300 hover:text-white hover:bg-gray-700"
					}`}>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
						</svg>
						<span className="font-medium">Dashboard</span>
					</button>
				</Link>

				<Link href="/dashboard/targets">
					<button className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
						currentPage === "targets"
							? "text-white bg-blue-600 hover:bg-blue-500"
							: "text-gray-300 hover:text-white hover:bg-gray-700"
					}`}>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
							<path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
						</svg>
						<span className="font-medium">Set Targets</span>
					</button>
				</Link>

				<Link href="/dashboard/scouting">
					<button className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
						currentPage === "scouting"
							? "text-white bg-blue-600 hover:bg-blue-500"
							: "text-gray-300 hover:text-white hover:bg-gray-700"
					}`}>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
						</svg>
						<span className="font-medium">Scouting Notes</span>
					</button>
				</Link>

				<Link href="/dashboard/table">
					<button className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
						currentPage === "tableview"
							? "text-white bg-blue-600 hover:bg-blue-500"
							: "text-gray-300 hover:text-white hover:bg-gray-700"
					}`}>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
						</svg>
						<span className="font-medium">Table View</span>
					</button>
				</Link>

				<Link href="/dashboard/draft-list">
					<button className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
						currentPage === "draftlist"
							? "text-white bg-blue-600 hover:bg-blue-500"
							: "text-gray-300 hover:text-white hover:bg-gray-700"
					}`}>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
							<path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
						</svg>
						<span className="font-medium">Draft List</span>
					</button>
				</Link>

				<Link href="/dashboard/team-visualizer">
					<button className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
						currentPage === "teamvisualizer"
							? "text-white bg-blue-600 hover:bg-blue-500"
							: "text-gray-300 hover:text-white hover:bg-gray-700"
					}`}>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
						</svg>
						<span className="font-medium">Team Visualizer</span>
					</button>
				</Link>

				<div className="pt-4 mt-4 border-t border-gray-700 space-y-2">
					<button
						onClick={onExport}
						className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
					>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
						</svg>
						<span className="font-medium">Export Settings</span>
					</button>

					<button
						onClick={onImport}
						className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
					>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
						</svg>
						<span className="font-medium">Import Settings</span>
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept=".json"
						onChange={onFileChange}
						className="hidden"
					/>

					{onToggleColorblindMode && (
						<div>
							<button
								onClick={onToggleColorblindMode}
								className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
							>
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
									<path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
									<path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
								</svg>
								<span className="font-medium">Colorblind Mode</span>
								<div className={`ml-auto w-10 h-5 rounded-full transition-colors ${colorblindMode ? 'bg-blue-600' : 'bg-gray-600'}`}>
									<div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${colorblindMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
								</div>
							</button>
							
							{/* Color customization options when colorblind mode is enabled */}
							{colorblindMode && onColorblindColorsChange && (
								<div className="mt-2 ml-4 mr-2 p-3 bg-gray-900 rounded-lg border border-gray-700 space-y-3">
									<div className="text-xs text-gray-400 font-medium mb-2">Custom Colors</div>
									
									<div className="flex items-center justify-between">
										<span className="text-xs text-gray-300">Above Target</span>
										<input
											type="color"
											value={colorblindColors.good}
											onChange={(e) => onColorblindColorsChange({ ...colorblindColors, good: e.target.value })}
											className="w-8 h-6 rounded cursor-pointer border border-gray-600"
										/>
									</div>
									
									<div className="flex items-center justify-between">
										<span className="text-xs text-gray-300">At Target</span>
										<input
											type="color"
											value={colorblindColors.atTarget || "#60a5fa"}
											onChange={(e) => onColorblindColorsChange({ ...colorblindColors, atTarget: e.target.value })}
											className="w-8 h-6 rounded cursor-pointer border border-gray-600"
										/>
									</div>
									
									<div className="flex items-center justify-between">
										<span className="text-xs text-gray-300">Close to Target</span>
										<input
											type="color"
											value={colorblindColors.warning}
											onChange={(e) => onColorblindColorsChange({ ...colorblindColors, warning: e.target.value })}
											className="w-8 h-6 rounded cursor-pointer border border-gray-600"
										/>
									</div>
									
									<div className="flex items-center justify-between">
										<span className="text-xs text-gray-300">Below Target</span>
										<input
											type="color"
											value={colorblindColors.bad}
											onChange={(e) => onColorblindColorsChange({ ...colorblindColors, bad: e.target.value })}
											className="w-8 h-6 rounded cursor-pointer border border-gray-600"
										/>
									</div>
									
									<button
										onClick={() => onColorblindColorsChange(DEFAULT_COLORBLIND_COLORS)}
										className="w-full mt-2 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
									>
										Reset to Defaults
									</button>
								</div>
							)}
						</div>
					)}
				</div>
			</nav>

			{/* Franchise Stats */}
			<div className="p-4 border-t border-gray-700 space-y-3">
				<div className="text-xs text-gray-400 uppercase font-semibold mb-2">Franchise Info</div>
				
				<div className="space-y-2">
					<div className="flex justify-between items-center">
						<span className="text-sm text-gray-400">Teams</span>
						<span className="text-sm font-bold text-blue-400">{currentFranchise?.teams?.length || 0}</span>
					</div>
					
					<div className="flex justify-between items-center">
						<span className="text-sm text-gray-400">Players</span>
						<span className="text-sm font-bold text-green-400">
							{currentFranchise?.teams?.reduce((acc, team) => acc + (team.players?.length || 0), 0) || 0}
						</span>
					</div>
					
					<div className="pt-2 border-t border-gray-700">
						<div className="text-xs text-gray-500 mb-1">General Manager</div>
						<div className="text-sm text-white font-medium">{currentFranchise?.gm?.name || "N/A"}</div>
						{currentFranchise?.agms && currentFranchise.agms.length > 0 && (
							<div className="mt-2">
								<div className="text-xs text-gray-500 mb-1">Assistant GMs</div>
								<div className="space-y-1">
									{currentFranchise.agms.map((agm, index) => (
										<div key={index} className="text-xs text-gray-300">{agm.name}</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Bottom Actions */}
			<div className="p-4 border-t border-gray-700">
				<button
					onClick={onChangeFranchise}
					className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
				>
					<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
					</svg>
					<span className="font-medium">Change Franchise</span>
				</button>
			</div>
		</div>
	);
}
