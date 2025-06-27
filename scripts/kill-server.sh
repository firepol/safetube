#!/bin/bash

# SafeTube Development Server Killer
# This script kills any development servers running on common development ports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 Checking for running development servers...${NC}"

# Function to kill process on a specific port
kill_port() {
    local port=$1
    local process_name=$2
    
    echo -e "${YELLOW}Checking port ${port} (${process_name})...${NC}"
    
    # Find processes using the port
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo -e "${RED}Found processes on port ${port}:${NC}"
        lsof -i:$port
        
        echo -e "${YELLOW}Killing processes...${NC}"
        echo $pids | xargs kill -9
        
        echo -e "${GREEN}✅ Successfully killed processes on port ${port}${NC}"
    else
        echo -e "${GREEN}✅ No processes found on port ${port}${NC}"
    fi
}

# Kill common development server ports
kill_port 5173 "Vite Dev Server"
kill_port 3000 "React Dev Server"
kill_port 8080 "Alternative Dev Server"
kill_port 4173 "Vite Preview Server"

# Also kill any node processes that might be hanging
echo -e "${YELLOW}Checking for hanging Node.js processes...${NC}"
node_pids=$(pgrep -f "node.*vite\|node.*electron" 2>/dev/null || true)

if [ -n "$node_pids" ]; then
    echo -e "${RED}Found hanging Node.js processes:${NC}"
    ps aux | grep -E "node.*vite|node.*electron" | grep -v grep || true
    
    echo -e "${YELLOW}Killing hanging Node.js processes...${NC}"
    echo $node_pids | xargs kill -9 2>/dev/null || true
    
    echo -e "${GREEN}✅ Successfully killed hanging Node.js processes${NC}"
else
    echo -e "${GREEN}✅ No hanging Node.js processes found${NC}"
fi

echo -e "${GREEN}🎉 Server cleanup complete!${NC}"
echo -e "${YELLOW}You can now safely run 'yarn electron:dev'${NC}" 