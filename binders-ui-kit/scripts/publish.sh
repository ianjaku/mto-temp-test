#!/bin/bash

set -e

rm -rf lib

tsc -p tsconfig.publish.json --skipLibCheck || exit 1
cd src && for f in `find . -name "*.styl"` ; do cp --parents $f ../lib ; done && cd -
cd src && for f in `find . -name "*.json"` ; do cp --parents $f ../lib ; done && cd -

npm --no-git-tag-version version patch
npm publish
