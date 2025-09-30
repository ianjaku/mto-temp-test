#!/bin/bash

mkdir -p lib/assets
rsync -r assets/ lib/assets/

while read line ;
    do
        echo "Change detected in '$line'. Rscyning changes."
        rsync -r assets/ lib/assets/
    done < <(inotifywait -e CLOSE_WRITE,MOVE,CREATE,DELETE --format "%f" -r assets -m)
