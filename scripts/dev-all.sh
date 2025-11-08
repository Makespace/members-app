#!/usr/bin/env bash

# Script to run all development processes concurrently
# Usage: ./scripts/dev-all.sh

set -e

echo "🚀 Starting development environment..."
echo ""

# Trap Ctrl+C and kill all background processes
trap 'echo ""; echo "🛑 Shutting down..."; kill 0' SIGINT SIGTERM

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run command with colored prefix
run_with_prefix() {
  local color=$1
  local prefix=$2
  shift 2
  "$@" 2>&1 | while IFS= read -r line; do
    echo -e "${color}[${prefix}]${NC} $line"
  done
}

# Start all processes in background
echo "📦 Starting Docker containers..."
run_with_prefix "$GREEN" "DOCKER" make dev &

echo "🔍 Starting type checker..."
run_with_prefix "$BLUE" "TYPES" make watch-typecheck &

echo "🧪 Starting test watcher..."
run_with_prefix "$YELLOW" "TESTS" npx jest --watch &

echo ""
echo "✅ All processes started!"
echo ""
echo "📍 App: http://localhost:8080"
echo "📧 Mail: http://localhost:1080"
echo ""
echo "Press Ctrl+C to stop all processes"
echo ""

# Wait for all background processes
wait
