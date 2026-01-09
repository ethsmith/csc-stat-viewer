import { useLocalStorage } from "../../../common/hooks/localStorage";

/**
 * Hook to manage common GM Dashboard localStorage settings
 * Consolidates all shared settings used across dashboard pages
 */
export function useGMSettings() {
	// Core settings
	const [selectedFranchise, setSelectedFranchise] = useLocalStorage("franchise", "");
	const [colorblindMode, setColorblindMode] = useLocalStorage("colorblindMode", "false");
	const [colorblindColors, setColorblindColors] = useLocalStorage("colorblindColors", JSON.stringify({ good: "#22d3ee", warning: "#fb923c", bad: "#c084fc" }));
	
	// Player tracking
	const [playerTargets, setPlayerTargets] = useLocalStorage("playerTargets", "{}");
	const [playerRoles, setPlayerRoles] = useLocalStorage("playerRoles", "{}");
	const [selectedStats, setSelectedStats] = useLocalStorage("selectedTargetStats", '["rating"]');
	
	// Dashboard layout
	const [sectionOrder, setSectionOrder] = useLocalStorage("dashboardSectionOrder", "[]");
	const [hiddenSections, setHiddenSections] = useLocalStorage("dashboardHiddenSections", "[]");
	const [collapsedSections, setCollapsedSections] = useLocalStorage("dashboardCollapsedSections", "[]");
	
	// Notes and lists
	const [scoutingNotes, setScoutingNotes] = useLocalStorage("scoutingNotes", "{}");
	const [myDraftList, setMyDraftList] = useLocalStorage("myDraftListByTier", "{}");
	
	// Table view
	const [tableViewFilterPresets, setTableViewFilterPresets] = useLocalStorage("tableViewFilterPresets", "[]");

	return {
		// Core settings
		selectedFranchise,
		setSelectedFranchise,
		colorblindMode,
		setColorblindMode,
		colorblindColors,
		setColorblindColors,
		
		// Player tracking
		playerTargets,
		setPlayerTargets,
		playerRoles,
		setPlayerRoles,
		selectedStats,
		setSelectedStats,
		
		// Dashboard layout
		sectionOrder,
		setSectionOrder,
		hiddenSections,
		setHiddenSections,
		collapsedSections,
		setCollapsedSections,
		
		// Notes and lists
		scoutingNotes,
		setScoutingNotes,
		myDraftList,
		setMyDraftList,
		
		// Table view
		tableViewFilterPresets,
		setTableViewFilterPresets,
	};
}
