#!/bin/bash

CLUSTER_NAME=${CLUSTER_NAME:-test-cluster}
RESOURCE_GROUP=${RESOURCE_GROUP:-test-rg}
LOCATION=${LOCATION:-westeurope}
KUBERNETES_VERSION=${KUBERNETES_VERSION:-1.24.10}

echo "Creating resource group ${RESOURCE_GROUP} in ${LOCATION}..."
az group create --name $RESOURCE_GROUP --location $LOCATION

echo "Creating AKS cluster ${CLUSTER_NAME} in ${RESOURCE_GROUP}..."
az aks create --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --kubernetes-version $KUBERNETES_VERSION --generate-ssh-keys --enable-managed-identity --node-count 3 --enable-addons monitoring

echo "Finished creating AKS cluster!"

az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --admin

echo "Finished fetching credentials"
