#!/bin/bash

if [ "$1" == "" ]; then
    echo "Usage: bash $0 <TARGET_LANGUAGE_CODE>"
fi

KUBECTL=`which kubectl`
SCRIPT_OUTPUT=`$KUBECTL exec local-dev -n develop -c binders-v3 -- /usr/local/bin/node dist/src/scripts/machineTranslateLabels.js $1`
echo $SCRIPT_OUTPUT;
$KUBECTL cp develop/local-dev:/tmp/$1.ts -c binders-v3 /tmp/$1.ts
mv -v /tmp/$1.ts ../src/i18n/translations/$1.ts