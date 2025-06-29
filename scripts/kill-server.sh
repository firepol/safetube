#!/bin/bash

# SafeTube Development Server Killer
# This script kills any development servers running on common development ports

set -e

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if verbose logging is enabled (command line takes precedence over .env)
VERBOSE=${ELECTRON_LOG_VERBOSE:-false}

# Verbose logging function
log_verbose() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "$1"
    fi
}

log_verbose "${YELLOW}🔍 Checking for running development servers...${NC}"

# Function to kill process on a specific port
kill_port() {
    local port=$1
    local process_name=$2
    
    log_verbose "${YELLOW}Checking port ${port} (${process_name})...${NC}"
    
    # Find processes using the port
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo -e "${RED}Found processes on port ${port}:${NC}"
        
        # Only show detailed process info if verbose logging is enabled
        if [ "$VERBOSE" = "true" ]; then
            lsof -i:$port
        fi
        
        log_verbose "${YELLOW}Killing processes...${NC}"
        echo $pids | xargs kill -9
        
        echo -e "${GREEN}✅ Successfully killed processes on port ${port}${NC}"
    else
        log_verbose "${GREEN}✅ No processes found on port ${port}${NC}"
    fi
}

# Kill common development server ports
kill_port 5173 "Vite Dev Server"
kill_port 3000 "React Dev Server"
kill_port 8080 "Alternative Dev Server"
kill_port 4173 "Vite Preview Server"

# Also kill any node processes that might be hanging
log_verbose "${YELLOW}Checking for hanging Node.js processes...${NC}"
node_pids=$(pgrep -f "node.*vite\|node.*electron" 2>/dev/null || true)

if [ -n "$node_pids" ]; then
    echo -e "${RED}Found hanging Node.js processes:${NC}"
    
    # Only show detailed process info if verbose logging is enabled
    if [ "$VERBOSE" = "true" ]; then
        ps aux | grep -E "node.*vite|node.*electron" | grep -v grep || true
    fi
    
    log_verbose "${YELLOW}Killing hanging Node.js processes...${NC}"
    echo $node_pids | xargs kill -9 2>/dev/null || true
    
    echo -e "${GREEN}✅ Successfully killed hanging Node.js processes${NC}"
else
    log_verbose "${GREEN}✅ No hanging Node.js processes found${NC}"
fi

log_verbose "${GREEN}🎉 Server cleanup complete!${NC}"
log_verbose "${YELLOW}You can now safely run 'yarn electron:dev'${NC}" 