import * as React from "react";

interface CollapsibleSectionProps {
	title: string;
	icon: React.ReactNode;
	iconColor?: string;
	headerExtra?: React.ReactNode;
	defaultExpanded?: boolean;
	isExpanded?: boolean;
	onToggleExpand?: (expanded: boolean) => void;
	children: React.ReactNode;
	className?: string;
	onHide?: () => void;
}

export function CollapsibleSection({
	title,
	icon,
	headerExtra,
	defaultExpanded = true,
	isExpanded: controlledExpanded,
	onToggleExpand,
	children,
	className = "",
	onHide,
}: CollapsibleSectionProps) {
	const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded);
	
	// Use controlled state if provided, otherwise use internal state
	const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
	
	const handleToggle = () => {
		const newValue = !isExpanded;
		if (onToggleExpand) {
			onToggleExpand(newValue);
		} else {
			setInternalExpanded(newValue);
		}
	};

	return (
		<div className={`bg-gray-800 rounded-lg border border-gray-700 overflow-hidden ${className}`}>
			{/* Header */}
			<div className="flex items-center">
				<button
					onClick={handleToggle}
					className="flex-1 px-6 py-4 flex items-center hover:bg-gray-750 transition-colors"
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
				{onHide && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							onHide();
						}}
						className="px-4 py-4 mr-8 text-gray-500 hover:text-gray-300 hover:bg-gray-750 transition-colors"
						title="Hide section"
					>
						<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
							<path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
						</svg>
					</button>
				)}
			</div>

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
