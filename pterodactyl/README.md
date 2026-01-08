# Pterodactyl Egg for CSC Stat Viewer

This directory contains a Pterodactyl Panel egg configuration for running the CSC Stat Viewer application.

## Installation

1. **Import the Egg**
   - Go to your Pterodactyl Admin Panel
   - Navigate to **Nests** → Select or create a nest
   - Click **Import Egg**
   - Upload `egg-csc-stat-viewer.json`

2. **Create a Server**
   - Create a new server using this egg
   - Configure the variables:
     - **GitHub Repository**: `owner/repo` format (e.g., `ethsmith/csc-stat-viewer`)
     - **GitHub Branch**: Branch to clone (default: `main`)
     - **GitHub Token**: For private repos, provide a Personal Access Token
     - **Auto Update**: Set to `true` to pull updates on each restart
     - **Node Environment**: `production` or `development`

3. **Allocate Resources**
   - Recommended: 1-2 GB RAM, 1-2 CPU cores
   - Disk: At least 1 GB for dependencies and build artifacts

## Features

- **Automatic Updates**: When `AUTO_UPDATE=true`, the server pulls the latest changes from GitHub on every restart
- **Private Repo Support**: Use a GitHub Personal Access Token for private repositories
- **Branch Selection**: Deploy from any branch
- **Production Build**: Builds and serves the optimized production bundle

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_REPO` | Repository in `owner/repo` format | `ethsmith/csc-stat-viewer` |
| `GITHUB_BRANCH` | Branch to deploy | `main` |
| `GITHUB_TOKEN` | PAT for private repos | (empty) |
| `AUTO_UPDATE` | Pull updates on start | `true` |
| `NODE_ENV` | Node environment | `production` |

> **Note:** `SERVER_PORT` is automatically provided by Pterodactyl based on the server's allocated port.

## Manual Update

To manually update without restarting:
1. Access the server console
2. Stop the server
3. Start the server (it will pull updates automatically if `AUTO_UPDATE=true`)

Or via SFTP/File Manager, you can run `git pull` manually.

## Troubleshooting

- **Build fails**: Check that Node.js version is compatible (18+ recommended)
- **Port already in use**: Ensure the allocated port matches `SERVER_PORT`
- **Clone fails**: Verify the repository URL and token (if private)
- **Updates not pulling**: Ensure `AUTO_UPDATE=true` and `.git` directory exists
