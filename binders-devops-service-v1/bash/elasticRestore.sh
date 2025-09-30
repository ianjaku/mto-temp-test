#!/usr/bin/env bash

set -e

NAMESPACE=${1:-develop}
SECRET_NAME="binders-es-elastic-user"
ES_MASTER_POD="binders-es-master-0"

# Get ElasticSearch password from Kubernetes secret
ES_PASS=$(kubectl -n $NAMESPACE get secret $SECRET_NAME -o go-template='{{.data.elastic | base64decode}}')

if [ -z "$ES_PASS" ]; then
	echo "Could not get password secret
    NAMESPACE=$NAMESPACE
    SECRET_NAME=$SECRET_NAME" >&2
	exit 1
fi

# Create Azure Snapshot Repository
kubectl -n $NAMESPACE exec -it $ES_MASTER_POD -- curl -u "elastic:${ES_PASS}" -X PUT "localhost:9200/_snapshot/manualto_azure_storage" -H 'Content-Type: application/json' -d'
{
  "type": "azure",
  "settings": {
    "container": "elasticbackups",
    "readonly": true
  }
}'

# List snapshots in the repository (Optional)
LATEST_SNAPSHOT=$(kubectl -n $NAMESPACE exec -it $ES_MASTER_POD -- curl -s -u "elastic:${ES_PASS}" "localhost:9200/_cat/snapshots/manualto_azure_storage?v" | tail -n +2 | awk '{print $1}' | sort | tail -n 1)


if [ -z "$LATEST_SNAPSHOT" ]; then
	echo "Could not get latest snapshot
    NAMESPACE=$NAMESPACE
    ES_MASTER_POD=$ES_MASTER_POD" >&2
	exit 1
fi

# Delete current data (Be careful with this step in production)
kubectl -n $NAMESPACE exec -it $ES_MASTER_POD -- curl -X DELETE -u "elastic:${ES_PASS}" localhost:9200/*
# Restore specific indices using patterns
# Exclude Kibana indices with "-.kibana*"
kubectl -n $NAMESPACE exec -it $ES_MASTER_POD -- curl -X POST -u "elastic:${ES_PASS}" "localhost:9200/_snapshot/manualto_azure_storage/${LATEST_SNAPSHOT}/_restore" -H 'Content-Type: application/json' -d'
{
  "indices": "publications-v*,binders-binders-v*,binders-collections-v*,useractions-v*",
  "ignore_unavailable": true,
  "include_global_state": false
}'
