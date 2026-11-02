#!/bin/sh
# Usage: tools/run-scenario.sh <name> [seconds] [extra query]   -> /tmp/scn-<name>.png + [scn] console lines
PORT=${PORT:-5199}
SECS=${2:-12}
google-chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --enable-logging=stderr --v=0 \
  --window-size=1000,640 --virtual-time-budget=$((SECS * 1000)) --screenshot="/tmp/scn-$1.png" \
  "http://localhost:$PORT/tools/scenario.html?s=$1$3" 2>&1 | grep -E "CONSOLE.*source: http://localhost" | grep -v "\[vite\]" | sed -E 's/.*CONSOLE:[0-9]+\] "//; s/", source: .*//'
