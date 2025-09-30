param location string
param resourceGroupName string

// User Assigned Identity
resource media_uai 'Microsoft.ManagedIdentity/userAssignedIdentities@2018-11-30' = {
  name: 'media-service-identity'
  location: location
}

// Role Assignment
resource role_assignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroupName, 'Contributor', media_uai.id)
  properties: {
    principalId: media_uai.properties.principalId
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')  // Contributor Role
    principalType: 'ServicePrincipal'
  }
}
