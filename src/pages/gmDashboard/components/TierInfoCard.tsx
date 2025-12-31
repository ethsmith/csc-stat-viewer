import * as React from "react";

interface TierInfoCardProps {
	tierName: string;
	mmrCap: number;
	playerCount: number;
}

export function TierInfoCard({ tierName, mmrCap, playerCount }: TierInfoCardProps) {
	return (
		<div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<p className="text-sm text-gray-400">Tier</p>
					<p className="text-lg font-bold">{tierName}</p>
				</div>
				<div>
					<p className="text-sm text-gray-400">MMR Cap</p>
					<p className="text-lg font-bold">{mmrCap}</p>
				</div>
				<div>
					<p className="text-sm text-gray-400">Total Players</p>
					<p className="text-lg font-bold">{playerCount}</p>
				</div>
			</div>
		</div>
	);
}
