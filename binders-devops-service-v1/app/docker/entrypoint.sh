#!/usr/bin/env bash
set -x

# SIGTERM-handler
term_handler() {
  pkill -f node
  exit 143; # 128 + 15 -- SIGTERM
}

# setup handlers
# on callback, kill the last background process, which is `tail -f /dev/null` and execute the specified handler
trap 'kill ${!}; term_handler' SIGTERM

# run application
"$@" &

# wait forever
while true
do
  tail -f /dev/null & wait ${!}
done