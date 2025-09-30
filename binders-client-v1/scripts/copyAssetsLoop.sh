#!/bin/bash

[ ! -d lib ] && mkdir lib
rsync -r assets/ lib/assets/

while read line ;
    echo "Change detected in '$line'. Rscyning changes."
    do
        rsync -r assets/ lib/assets/
    done < <(inotifywait -e CLOSE_WRITE,MOVE,CREATE,DELETE --format "%f" -r assets -m)