#!/usr/bin/env bash
set -e

NAMESPACE=${1:-develop}
SECRET_NAME="binders-es-elastic-user"
POD_NAME="binders-es-master-0"

# ElasticSearch password
ES_PASS=$(kubectl -n $NAMESPACE get secret $SECRET_NAME -o go-template='{{.data.elastic | base64decode}}')

# Step 5: Change alias for publications index
echo "Changing alias for publications index..."
kubectl -n $NAMESPACE exec -it $POD_NAME -- /bin/bash -c "curl -u \"elastic:${ES_PASS}\" -X POST \"http://localhost:9200/_aliases\" -H \"Content-Type: application/json\" -d '
{
  \"actions\": [
    {
      \"add\": {
        \"index\": \"publications-v3\",
        \"alias\": \"publications\"
      }
    },
    {
        \"remove\": {
          \"index\": \"publications-v2\",
          \"alias\": \"publications\"
        }
    }
  ]
}'"

# Step 6: Remove old publications index
echo "Removing old publications index..."
kubectl -n $NAMESPACE exec -it $POD_NAME -- /bin/bash -c "curl -u \"elastic:${ES_PASS}\" -X DELETE \"http://localhost:9200/publications-v2\""

echo "Operations completed."
