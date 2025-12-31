import * as React from "react";

interface Team {
	id: string;
	name: string;
	tier: {
		name: string;
	};
}

interface TeamTabsProps {
	teams: Team[];
	selectedTeamId: string | null;
	onSelectTeam: (teamId: string) => void;
}

export function TeamTabs({ teams, selectedTeamId, onSelectTeam }: TeamTabsProps) {
	return (
		<div className="border-b border-gray-700 mb-6">
			<div className="flex gap-2 overflow-x-auto">
				{teams.map(team => (
					<button
						key={team.id}
						onClick={() => onSelectTeam(team.id)}
						className={`px-6 py-3 font-semibold whitespace-nowrap transition-colors border-b-2 ${
							selectedTeamId === team.id
								? "border-blue-500 text-blue-400"
								: "border-transparent text-gray-400 hover:text-gray-200"
						}`}
					>
						{team.name}
						<span className="ml-2 text-xs px-2 py-1 rounded bg-gray-700">
							{team.tier.name}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
