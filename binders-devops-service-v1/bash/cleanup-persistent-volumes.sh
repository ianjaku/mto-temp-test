#!/bin/bash

released_pvs=$(kubectl get pv --no-headers | awk '$5 == "Released" {print $1}')

if [ -z "$released_pvs" ]; then
  echo "No released persistent volumes found."
else
  for pv in $released_pvs; do
    echo "Deleting released persistent volume: $pv"
    kubectl delete pv $pv
    if [ $? -eq 0 ]; then
      echo "Persistent volume $pv deleted successfully."
    else
      echo "Failed to delete persistent volume $pv."
    fi
  done
fi
