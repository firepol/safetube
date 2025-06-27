# SafeTube Scripts

This directory contains utility scripts for the SafeTube project.

## Server Management Scripts

### `kill-server.sh`
A robust script to kill development servers and clean up hanging processes.

**Usage:**
```bash
# Run directly
./scripts/kill-server.sh

# Or via yarn
yarn killserver:robust
```

**What it does:**
- Kills processes on common development ports (5173, 3000, 8080, 4173)
- Cleans up hanging Node.js processes
- Provides colored output and clear feedback
- Safe to run even when no servers are running

**Ports checked:**
- `5173` - Vite Dev Server
- `3000` - React Dev Server  
- `8080` - Alternative Dev Server
- `4173` - Vite Preview Server

## Package.json Scripts

The following scripts are available in `package.json`:

- `yarn killserver:linux` - Quick kill for Linux (port 5173 only)
- `yarn killserver:mac` - Quick kill for macOS (port 5173 only)
- `yarn killserver:win` - Quick kill for Windows (port 5173 only)
- `yarn killserver` - Default kill script (Linux)
- `yarn killserver:robust` - Full server cleanup using the shell script

## Best Practices

1. **Always kill servers** after running tests or development commands
2. **Use `yarn killserver:robust`** for thorough cleanup
3. **Run `yarn electron:dev`** which automatically kills servers first
4. **Check for hanging processes** if you encounter port conflicts

## Troubleshooting

If you still get port conflicts after running the kill scripts:

1. Check what's using the port: `lsof -i:5173`
2. Manually kill the process: `kill -9 <PID>`
3. Restart your terminal if needed
4. Use the robust script: `yarn killserver:robust` 