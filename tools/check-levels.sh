#!/bin/sh
# Usage: tools/check-levels.sh ["level=cliff&i=0"]  -> [lvl] PASS/FAIL lines, screenshot of the last state in /tmp/levels.png
# Needs the dev server: npx vite --port 5199 --strictPort &
PORT=${PORT:-5199}
google-chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --enable-logging=stderr --v=0 \
  --window-size=1000,640 --virtual-time-budget=${SECS:-60000} --screenshot=/tmp/levels.png \
  "http://localhost:$PORT/tools/levels.html?$1" 2>&1 | grep -E "CONSOLE.*source: http://localhost" | grep -v "\[vite\]" | sed -E 's/.*CONSOLE:[0-9]+\] "//; s/", source: .*//'
