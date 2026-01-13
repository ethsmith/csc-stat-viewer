import * as React from "react";

interface DraggableSectionProps {
	id: string;
	index: number;
	isDragging: boolean;
	dragOverIndex: number | null;
	onDragStart: (index: number) => void;
	onDragOver: (e: React.DragEvent, index: number) => void;
	onDragEnd: () => void;
	onDrop: (e: React.DragEvent, index: number) => void;
	children: React.ReactNode;
}

export function DraggableSection({
	id,
	index,
	isDragging,
	dragOverIndex,
	onDragStart,
	onDragOver,
	onDragEnd,
	onDrop,
	children,
}: DraggableSectionProps) {
	const isOver = dragOverIndex === index;

	return (
		<div
			draggable
			onDragStart={() => onDragStart(index)}
			onDragOver={(e) => onDragOver(e, index)}
			onDragEnd={onDragEnd}
			onDrop={(e) => onDrop(e, index)}
			className={`relative group transition-all duration-200 ${
				isDragging ? "opacity-50" : ""
			} ${isOver ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900 rounded-lg" : ""}`}
		>
			{/* Drag handle - inside box, top-right corner, visible on hover */}
			<div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-grab active:cursor-grabbing">
				<div className="p-1.5 rounded bg-gray-600/80 hover:bg-gray-500/80 backdrop-blur-sm">
					<svg className="h-4 w-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
						<path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
					</svg>
				</div>
			</div>
			{children}
		</div>
	);
}

export type SectionId = "insights" | "teamSummary" | "roleFitScore" | "playstyleAnalysis" | "playerTable" | "mmrSummary";

export const DEFAULT_SECTION_ORDER: SectionId[] = [
	"insights",
	"teamSummary",
	"roleFitScore",
	"playstyleAnalysis",
	"playerTable",
	"mmrSummary",
];

export const SECTION_LABELS: Record<SectionId, string> = {
	insights: "Actionable Insights",
	teamSummary: "Team Summary",
	roleFitScore: "Role Fit Score",
	playstyleAnalysis: "Playstyle Analysis",
	playerTable: "Player Table",
	mmrSummary: "MMR Summary",
};
