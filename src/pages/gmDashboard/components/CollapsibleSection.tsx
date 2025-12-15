import * as React from "react";

interface CollapsibleSectionProps {
	title: string;
	icon: React.ReactNode;
	iconColor?: string;
	headerExtra?: React.ReactNode;
	defaultExpanded?: boolean;
	children: React.ReactNode;
	className?: string;
}

export function CollapsibleSection({
	title,
	icon,
	headerExtra,
	defaultExpanded = true,
	children,
	className = "",
}: CollapsibleSectionProps) {
	const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

	return (
		<div className={`bg-gray-800 rounded-lg border border-gray-700 overflow-hidden ${className}`}>
			{/* Header */}
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full px-6 py-4 flex items-center hover:bg-gray-750 transition-colors"
			>
				<svg
					className={`h-5 w-5 text-gray-400 transition-transform mr-3 ${isExpanded ? 'rotate-180' : ''}`}
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
				</svg>
				<div className="flex items-center gap-3 flex-1">
					{icon}
					<h3 className="text-xl font-bold text-white">{title}</h3>
					{headerExtra}
				</div>
			</button>

			{/* Content */}
			{isExpanded && (
				<div className="px-6 pb-6 pt-2">
					{children}
				</div>
			)}
		</div>
	);
}

export const SectionIcons = {
	insights: (
		<svg className="h-6 w-6 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
			<path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
			<path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
		</svg>
	),
	team: (
		<svg className="h-6 w-6 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
			<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
		</svg>
	),
	roleFit: (
		<svg className="h-6 w-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
			<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
		</svg>
	),
};
