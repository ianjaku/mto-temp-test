#!/bin/bash

# Find all files starting with sort-imports- and sort them
latest_file=$(ls sort-imports-* 2>/dev/null | sort -V | tail -n 1)

if [ -z "$latest_file" ]; then
    echo "No files found matching pattern 'sort-imports-*'" >&2
    exit 1
fi

echo "Installing $latest_file"

code --install-extension $latest_file
