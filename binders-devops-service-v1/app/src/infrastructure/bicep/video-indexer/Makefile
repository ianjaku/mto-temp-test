LOCATION=westeurope
MANAGED_IDENTITY_RESOURCE_ID=/subscriptions/0370c56f-76ae-4423-8da8-c391ad332bf4/resourcegroups/media/providers/Microsoft.ManagedIdentity/userAssignedIdentities/media-service-identity
MEDIA_SERVICE_RESOURCE_ID=/subscriptions/0370c56f-76ae-4423-8da8-c391ad332bf4/resourceGroups/media/providers/Microsoft.Media/mediaservices/manualtovideos
MEDIA_SERVICE_NAME=media
RESOURCE_GROUP=media
ROLE_BICEP_FILE=role.bicep
SUBSCRIPTION_ID=0370c56f-76ae-4423-8da8-c391ad332bf4
VIDEO_INDEXER_BICEP_FILE=video-indexer.bicep

# Phony targets ensure that a command runs each time
.PHONY: login install-bicep verify-bicep deploy-role

login:
	az login

install-bicep:
	az bicep install

verify-bicep:
	az bicep version

set-production-subscription:
	az account set --subscription ${SUBSCRIPTION_ID}

test-deploy-role: verify-bicep set-production-subscription
	az deployment group what-if \
    --resource-group $(RESOURCE_GROUP) \
    --template-file $(ROLE_BICEP_FILE) \
    --parameters location=${LOCATION} mediaServiceName=${MEDIA_SERVICE_NAME} resourceGroupName=${RESOURCE_GROUP} subscriptionId=${SUBSCRIPTION_ID}

deploy-role: verify-bicep set-production-subscription
	az deployment group create \
    --resource-group $(RESOURCE_GROUP) \
    --template-file $(ROLE_BICEP_FILE) \
    --parameters location=${LOCATION} resourceGroupName=${RESOURCE_GROUP}

deploy-video-indexer: verify-bicep set-production-subscription
	az deployment group create \
    --resource-group $(RESOURCE_GROUP) \
    --template-file $(VIDEO_INDEXER_BICEP_FILE) \
    --parameters accountName=manualtovideos managedIdentityResourceId=${MANAGED_IDENTITY_RESOURCE_ID} mediaServiceAccountResourceId=${MEDIA_SERVICE_RESOURCE_ID}
