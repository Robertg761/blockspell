#!/bin/sh
# Usage: tools/shot.sh "<gallery query>" /tmp/out.png [WxH]
# Screenshots tools/gallery.html via headless Chrome. Needs the dev server:
#   npx vite --port 5199 --strictPort &
PORT=${PORT:-5199}
SIZE=${3:-1600,1000}
google-chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size="$SIZE" --virtual-time-budget=6000 --screenshot="$2" \
  "http://localhost:$PORT/tools/gallery.html?$1" >/dev/null 2>&1
echo "wrote $2"
