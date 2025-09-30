#!/bin/bash

# Check if a namespace is provided as an argument
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <namespace>"
  exit 1
fi

NAMESPACE=$1

# Get all deployments in the specified namespace
deployments=$(kubectl get deployments -n $NAMESPACE --no-headers -o custom-columns=":metadata.name")

# Check if there are any deployments in the namespace
if [ -z "$deployments" ]; then
  echo "No deployments found in namespace: $NAMESPACE"
else
  # Loop through the list of deployments and restart them
  for deployment in $deployments; do
    echo "Restarting deployment: $deployment"
    kubectl rollout restart deployment $deployment -n $NAMESPACE
    if [ $? -eq 0 ]; then
      echo "Deployment $deployment restarted successfully."
    else
      echo "Failed to restart deployment $deployment."
    fi
  done
fi
