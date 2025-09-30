environment = "prod"
location    = "westeurope"
project     = "binder"
tags = {
  Environment = "prod"
  ManagedBy   = "terraform"
  Product     = "manualto"
}
subscription_id            = "93eddcda-b319-4357-9de4-cb610ae0ede9" #manual-to-prod
tenant_id                  = "276c232d-1bf1-48dc-9acb-675ef2639f43"
tf_resource_group          = "binder-prod-tstate"
tf_storage_account         = "binderprodstate"
development_group_id       = "c77a4612-3d76-4895-987d-98eb600b19be"
log_analytics_workspace_id = "/subscriptions/93eddcda-b319-4357-9de4-cb610ae0ede9/resourceGroups/binder-prod-resource-group/providers/Microsoft.OperationalInsights/workspaces/binder-prod-17635606227094847570"
