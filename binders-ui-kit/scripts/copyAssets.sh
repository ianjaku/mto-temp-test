#!/bin/bash

mkdir -p lib
cd src && for f in `find . -name "*.styl"` ; do cp --parents $f ../lib ; done && cd -
cd src && for f in `find . -name "*.json"` ; do cp --parents $f ../lib ; done && cd -
chown -R node lib