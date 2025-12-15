import * as React from "react";
import { createPortal } from "react-dom";

interface SparklineProps {
	data: number[];
	width?: number;
	height?: number;
	color?: string;
	showDot?: boolean;
	statLabel?: string;
}

export function Sparkline({ 
	data, 
	width = 60, 
	height = 20, 
	color = "#60a5fa",
	showDot = true,
	statLabel = "Value"
}: SparklineProps) {
	const [showTooltip, setShowTooltip] = React.useState(false);
	const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });
	const containerRef = React.useRef<HTMLDivElement>(null);

	const handleMouseEnter = (e: React.MouseEvent) => {
		if (containerRef.current) {
			const rect = containerRef.current.getBoundingClientRect();
			setTooltipPosition({
				x: rect.left + rect.width / 2,
				y: rect.bottom + 8
			});
		}
		setShowTooltip(true);
	};

	if (!data || data.length === 0) {
		return <div style={{ width, height }} className="bg-gray-700 rounded" />;
	}

	// Data comes in chronological order (oldest to newest)
	// Display as-is for sparkline (left to right = oldest to newest)
	const min = Math.min(...data);
	const max = Math.max(...data);
	const range = max - min || 1;

	const points = data.map((value, index) => {
		const x = (index / (data.length - 1)) * width;
		const y = height - ((value - min) / range) * height;
		return `${x},${y}`;
	}).join(' ');

	const lastValue = data[data.length - 1];
	const lastX = width;
	const lastY = height - ((lastValue - min) / range) * height;

	// Determine trend direction (oldest half vs newest half)
	const firstHalf = data.slice(0, Math.floor(data.length / 2));
	const secondHalf = data.slice(Math.floor(data.length / 2));
	const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
	const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
	const isUptrend = secondAvg > firstAvg;
	const trendColor = isUptrend ? "#4ade80" : "#f87171";

	// Take last 5 from chronological data (most recent 5 matches)
	const last5Values = data.slice(-5);
	const tooltipText = last5Values.map((v, i) => `${i + 1}: ${v.toFixed(2)}`).join(', ');

	return (
		<>
		<div 
			ref={containerRef}
			className="relative inline-block"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={() => setShowTooltip(false)}
		>
			<svg width={width} height={height} className="inline-block cursor-pointer">
			<polyline
				points={points}
				fill="none"
				stroke={trendColor}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{showDot && (
				<circle
					cx={lastX}
					cy={lastY}
					r="2"
					fill={trendColor}
				/>
			)}
			</svg>
		</div>
		{showTooltip && createPortal(
			<div 
				className="fixed px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap border border-gray-700 pointer-events-none"
				style={{
					left: `${tooltipPosition.x}px`,
					top: `${tooltipPosition.y}px`,
					transform: 'translateX(-50%)',
					zIndex: 9999
				}}
			>
				<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1">
					<div className="border-4 border-transparent border-b-gray-900"></div>
				</div>
				<div className="font-semibold mb-1">{statLabel} - Last 5 Matches</div>
				<div className="space-y-0.5">
					{[...last5Values].reverse().map((value, index) => (
						<div key={index} className="flex justify-between gap-3">
							<span className="text-gray-400">Match {last5Values.length - index}:</span>
							<span className="font-mono">{value.toFixed(2)}</span>
						</div>
					))}
				</div>
			</div>,
			document.body
		)}
		</>
	);
}
