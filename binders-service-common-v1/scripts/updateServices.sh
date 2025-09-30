#!/usr/bin/env bash

pids=""

THIS_DIR=`dirname $0`
BASE_DIR="${THIS_DIR}/../.."

SERVICE_DIRS="binders-account-service-v1/app
binders-credential-service-v1/app
binders-editor-service-v1/service
binders-image-service-v1/app
binders-manage-service-v1/app
binders-user-service-v1/app
manualto-service-v1/service
"

for SERVICE_DIR in ${SERVICE_DIRS}; do
   /bin/bash -c "cd ${BASE_DIR}/${SERVICE_DIR} && npm run update-binders-deps" &
   pids="$pids $!"
done

wait $pids
