#!/bin/bash

copy_assets() {
    [ ! -d "lib" ] && mkdir lib
    cd src && find . \( -name "*.styl" -o -name "*.json" \) -exec cp --parents -t ../lib/ {} + && cd - || exit
}

echo "Copying assets"
copy_assets

if [ "${1:-}" = "--nowatch" ]; then
    exit 0
fi

while read -r line; do
    echo "Changed detected in file '$line'. Rsyncing changes."
    if [[ $line =~ ^.*\.(styl|json)$ ]]; then
        copy_assets
    fi
done < <(inotifywait -e CLOSE_WRITE,MOVE,CREATE,DELETE --format "%f" -r src -m)
