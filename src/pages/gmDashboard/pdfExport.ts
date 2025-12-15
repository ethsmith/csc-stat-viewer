import { toPng } from "html-to-image";

interface TeamReportData {
	teamName: string;
	tierName: string;
	franchiseName: string;
	players: Array<{
		name: string;
		mmr: number;
		stats?: Record<string, number | string | undefined>;
	}>;
	teamStats: {
		totalMMR: number;
		avgMMR: number;
		mmrCap: number;
		mmrRemaining: number;
	};
}

export async function generateTeamSnapshot(
	contentElement: HTMLElement,
	teamData: TeamReportData
): Promise<void> {
	try {
		// Create a wrapper to capture at full width
		const wrapper = document.createElement('div');
		wrapper.style.cssText = `
			position: fixed;
			left: 0;
			top: 0;
			width: 1400px;
			background-color: #111827;
			z-index: -9999;
			padding: 24px;
			color: white;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		`;
		
		// Clone the content
		const clone = contentElement.cloneNode(true) as HTMLElement;
		clone.style.width = '100%';
		clone.style.maxWidth = 'none';
		clone.style.overflow = 'visible';
		
		// Remove overflow constraints from all children
		clone.querySelectorAll('*').forEach(el => {
			if (el instanceof HTMLElement) {
				if (el.style.overflow === 'auto' || el.style.overflow === 'hidden') {
					el.style.overflow = 'visible';
				}
				el.style.maxWidth = 'none';
			}
		});
		
		wrapper.appendChild(clone);
		document.body.appendChild(wrapper);
		
		// Wait for render
		await new Promise(resolve => setTimeout(resolve, 150));
		
		const dataUrl = await toPng(wrapper, {
			quality: 0.95,
			pixelRatio: 1,
			backgroundColor: "#111827"
		});
		
		// Clean up
		document.body.removeChild(wrapper);

		const printWindow = window.open("", "_blank");
		if (!printWindow) {
			alert("Please allow popups to generate the PDF report");
			return;
		}

		const timestamp = new Date().toLocaleString();

		printWindow.document.write(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>${teamData.franchiseName} - ${teamData.teamName} Report</title>
				<style>
					* { box-sizing: border-box; }
					@media print {
						body { margin: 0; padding: 10px; }
						.no-print { display: none !important; }
						.container { max-width: 100%; }
					}
					@page {
						size: landscape;
						margin: 0.5cm;
					}
					body {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						background: #111827;
						color: white;
						margin: 0;
						padding: 16px;
					}
					.container {
						max-width: 1400px;
						margin: 0 auto;
					}
					.header {
						display: flex;
						justify-content: space-between;
						align-items: center;
						margin-bottom: 16px;
						padding-bottom: 12px;
						border-bottom: 1px solid #374151;
					}
					.header-left h1 {
						margin: 0;
						font-size: 20px;
						color: #60A5FA;
					}
					.header-left h2 {
						margin: 4px 0 0 0;
						font-size: 14px;
						color: #9CA3AF;
						font-weight: normal;
					}
					.header-right {
						text-align: right;
					}
					.header-right .timestamp {
						font-size: 11px;
						color: #6B7280;
					}
					.team-stats {
						display: flex;
						justify-content: flex-start;
						gap: 24px;
						margin-bottom: 16px;
						padding: 12px 16px;
						background: #1F2937;
						border-radius: 6px;
					}
					.stat-item {
						text-align: center;
					}
					.stat-label {
						font-size: 10px;
						color: #9CA3AF;
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}
					.stat-value {
						font-size: 18px;
						font-weight: bold;
						color: #60A5FA;
					}
					.snapshot {
						background: #1F2937;
						border-radius: 6px;
						padding: 8px;
					}
					.snapshot img {
						width: 100%;
						height: auto;
						display: block;
						border-radius: 4px;
					}
					.print-btn {
						position: fixed;
						top: 16px;
						right: 16px;
						padding: 10px 20px;
						background: #2563EB;
						color: white;
						border: none;
						border-radius: 6px;
						cursor: pointer;
						font-size: 13px;
						font-weight: 600;
						z-index: 1000;
					}
					.print-btn:hover {
						background: #1D4ED8;
					}
				</style>
			</head>
			<body>
				<button class="print-btn no-print" onclick="window.print()">
					Print / Save as PDF
				</button>
				
				<div class="container">
					<div class="header">
						<div class="header-left">
							<h1>${teamData.franchiseName}</h1>
							<h2>${teamData.teamName} • ${teamData.tierName}</h2>
						</div>
						<div class="header-right">
							<div class="timestamp">Generated: ${timestamp}</div>
						</div>
					</div>
					
					<div class="team-stats">
						<div class="stat-item">
							<div class="stat-label">Total MMR</div>
							<div class="stat-value">${teamData.teamStats.totalMMR}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">Avg MMR</div>
							<div class="stat-value">${teamData.teamStats.avgMMR}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">MMR Cap</div>
							<div class="stat-value">${teamData.teamStats.mmrCap}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">Remaining</div>
							<div class="stat-value">${teamData.teamStats.mmrRemaining}</div>
						</div>
					</div>
					
					<div class="snapshot">
						<img src="${dataUrl}" alt="Dashboard Snapshot" />
					</div>
				</div>
			</body>
			</html>
		`);

		printWindow.document.close();
	} catch (error) {
		console.error("Error generating snapshot:", error);
		alert("Failed to generate snapshot. Please try again.");
	}
}

export async function generateAllTeamsReport(
	teams: Array<{
		element: HTMLElement;
		data: TeamReportData;
	}>,
	franchiseName: string
): Promise<void> {
	try {
		const snapshots: Array<{ dataUrl: string; data: TeamReportData }> = [];

		for (const team of teams) {
			const dataUrl = await toPng(team.element, {
				quality: 1,
				pixelRatio: 2,
				backgroundColor: "#111827"
			});
			snapshots.push({ dataUrl, data: team.data });
		}

		const printWindow = window.open("", "_blank");
		if (!printWindow) {
			alert("Please allow popups to generate the PDF report");
			return;
		}

		const timestamp = new Date().toLocaleString();

		const teamsHtml = snapshots.map(({ dataUrl, data }) => `
			<div class="team-section">
				<div class="team-header">
					<h2>${data.teamName}</h2>
					<span class="tier-badge">${data.tierName}</span>
				</div>
				
				<div class="team-stats">
					<div class="stat-item">
						<div class="stat-label">Total MMR</div>
						<div class="stat-value">${data.teamStats.totalMMR}</div>
					</div>
					<div class="stat-item">
						<div class="stat-label">Avg MMR</div>
						<div class="stat-value">${data.teamStats.avgMMR}</div>
					</div>
					<div class="stat-item">
						<div class="stat-label">MMR Cap</div>
						<div class="stat-value">${data.teamStats.mmrCap}</div>
					</div>
					<div class="stat-item">
						<div class="stat-label">Remaining</div>
						<div class="stat-value">${data.teamStats.mmrRemaining}</div>
					</div>
				</div>
				
				<div class="snapshot">
					<img src="${dataUrl}" alt="${data.teamName} Snapshot" />
				</div>
			</div>
		`).join('<div class="page-break"></div>');

		printWindow.document.write(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>${franchiseName} - Full Report</title>
				<style>
					@media print {
						body { margin: 0; }
						.no-print { display: none !important; }
						.page-break { page-break-before: always; }
					}
					body {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						background: #111827;
						color: white;
						margin: 0;
						padding: 20px;
					}
					.header {
						text-align: center;
						margin-bottom: 30px;
						padding-bottom: 20px;
						border-bottom: 2px solid #374151;
					}
					.header h1 {
						margin: 0 0 8px 0;
						font-size: 28px;
						color: #60A5FA;
					}
					.header .timestamp {
						font-size: 12px;
						color: #6B7280;
					}
					.team-section {
						margin-bottom: 40px;
						padding: 20px;
						background: #1F2937;
						border-radius: 12px;
					}
					.team-header {
						display: flex;
						align-items: center;
						gap: 12px;
						margin-bottom: 16px;
					}
					.team-header h2 {
						margin: 0;
						font-size: 20px;
					}
					.tier-badge {
						padding: 4px 12px;
						background: #374151;
						border-radius: 4px;
						font-size: 12px;
						color: #9CA3AF;
					}
					.team-stats {
						display: flex;
						justify-content: flex-start;
						gap: 30px;
						margin-bottom: 16px;
						padding: 12px;
						background: #111827;
						border-radius: 8px;
					}
					.stat-item {
						text-align: center;
					}
					.stat-label {
						font-size: 11px;
						color: #9CA3AF;
						text-transform: uppercase;
					}
					.stat-value {
						font-size: 18px;
						font-weight: bold;
						color: #60A5FA;
					}
					.snapshot img {
						max-width: 100%;
						border-radius: 8px;
					}
					.print-btn {
						position: fixed;
						top: 20px;
						right: 20px;
						padding: 12px 24px;
						background: #2563EB;
						color: white;
						border: none;
						border-radius: 8px;
						cursor: pointer;
						font-size: 14px;
						font-weight: 600;
						z-index: 1000;
					}
					.print-btn:hover {
						background: #1D4ED8;
					}
					.page-break {
						height: 40px;
					}
				</style>
			</head>
			<body>
				<button class="print-btn no-print" onclick="window.print()">
					Print / Save as PDF
				</button>
				
				<div class="header">
					<h1>${franchiseName} - Franchise Report</h1>
					<div class="timestamp">Generated: ${timestamp}</div>
				</div>
				
				${teamsHtml}
			</body>
			</html>
		`);

		printWindow.document.close();
	} catch (error) {
		console.error("Error generating report:", error);
		alert("Failed to generate report. Please try again.");
	}
}
