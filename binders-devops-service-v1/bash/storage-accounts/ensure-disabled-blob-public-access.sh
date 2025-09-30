#!/bin/bash

# Initialize dryRun to false
dryRun=false

# Check for the --dry-run flag
if [ "$1" == "--dry-run" ]; then
  dryRun=true
fi

# Function to check and optionally block public access
check_and_block_public_access() {
  local storageAccount=$1
  local resourceGroup=$2
  local allowBlobPublicAccess=$(az storage account show --name $storageAccount --resource-group $resourceGroup --query 'allowBlobPublicAccess' --output tsv)
  
  if [ "$allowBlobPublicAccess" == "true" ]; then
    echo "Storage account $storageAccount in resource group $resourceGroup has public blob access enabled."
    
    if [ "$dryRun" == "false" ]; then
      az storage account update --name $storageAccount --resource-group $resourceGroup --allow-blob-public-access false
      echo "Public blob access blocked for storage account $storageAccount."
    fi
  fi
}

# List all storage accounts
storageAccounts=$(az storage account list --query '[].{name:name, resourceGroup:resourceGroup}' --output json)

# Loop through each storage account to check its settings
for row in $(echo "${storageAccounts}" | jq -r '.[] | @base64'); do
  _jq() {
    echo ${row} | base64 --decode | jq -r ${1}
  }

  storageAccount=$(_jq '.name')
  resourceGroup=$(_jq '.resourceGroup')
  
  check_and_block_public_access $storageAccount $resourceGroup
done
