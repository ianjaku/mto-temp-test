#!/bin/bash

# Initialize dryRun to false
dryRun=false

# Check for the --dry-run flag
if [ "$1" == "--dry-run" ]; then
  dryRun=true
fi

# Function to check and optionally fix secure transfer settings
check_and_fix_secure_transfer() {
  local storageAccount=$1
  local resourceGroup=$2
  local secureTransferEnabled=$(az storage account show --name $storageAccount --resource-group $resourceGroup --query 'enableHttpsTrafficOnly' --output tsv)
  
  if [ "$secureTransferEnabled" == "false" ]; then
    echo "Storage account $storageAccount in resource group $resourceGroup has secure transfer disabled."
    
    if [ "$dryRun" == "false" ]; then
      az storage account update --name $storageAccount --resource-group $resourceGroup --https-only true
      echo "Secure transfer enabled for storage account $storageAccount."
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
  
  check_and_fix_secure_transfer $storageAccount $resourceGroup
done
