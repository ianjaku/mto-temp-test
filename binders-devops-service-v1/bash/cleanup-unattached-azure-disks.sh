#!/bin/bash

# Get all unattached disks
unattached_disks=$(az disk list --query "[?managedBy==null].[name, resourceGroup]" -o json | jq -r '.[] | @tsv')

if [ -z "$unattached_disks" ]; then
    echo "No unattached disks to delete"
else
    # Loop through each disk and delete
    while IFS=$'\t' read -r disk resource_group; do
        echo "Deleting disk $disk in resource group $resource_group"
        az disk delete --name "$disk" --resource-group "$resource_group" --yes --no-wait
    done <<< "$unattached_disks"
    echo "Finished deleting all unattached disks"
fi
