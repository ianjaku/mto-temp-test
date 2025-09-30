
module "screenshot" {
  source                         = "../../modules/screenshot"
  environment                    = var.environment
  kv_owner_identities            = var.kv_owner_identities
  location                       = var.location
  project                        = var.project
  read_identity_id               = module.function.identity_id
  video_storage_account_name     = var.video_storage_account_name
  video_storage_access_key       = var.video_storage_access_key
  new_video_storage_account_name = var.video_new_storage_account_name
  new_video_storage_access_key   = var.video_new_storage_access_key
  tags                           = var.tags
  tenant_id                      = var.tenant_id
}

module "function" {
  source          = "../../../modules/function"
  environment     = var.environment
  function_name   = "take-screenshot-v2"
  storage_name    = "screenshot2"
  app_service_sku = "P1v3"
  app_settings = {
    "WEBSITE_RUN_FROM_PACKAGE"  = 1
    "BLOB_STORAGE_ACCOUNT"      = "@Microsoft.KeyVault(SecretUri=${module.screenshot.vault_uri}secrets/${module.screenshot.account_name}/${module.screenshot.account_name_version})"
    "BLOB_STORAGE_SECRET"       = "@Microsoft.KeyVault(SecretUri=${module.screenshot.vault_uri}secrets/${module.screenshot.access_key}/${module.screenshot.access_key_version})"
    "NEW_BLOB_STORAGE_ACCOUNT"  = "@Microsoft.KeyVault(SecretUri=${module.screenshot.vault_uri}secrets/${module.screenshot.new_account_name}/${module.screenshot.new_account_name_version})"
    "NEW_BLOB_STORAGE_SECRET"   = "@Microsoft.KeyVault(SecretUri=${module.screenshot.vault_uri}secrets/${module.screenshot.new_access_key}/${module.screenshot.new_access_key_version})"
    "SLACK_WEBHOOK_URL"         = var.slack_webhook_url
    "ENVIRONMENT"               = var.environment
    "WEBSITE_WEBDEPLOY_USE_SCM" = true
  }
  location                   = var.location
  project                    = var.project
  tags                       = var.tags
  principal_id               = var.development_group_id
  log_analytics_workspace_id = var.log_analytics_workspace_id
}
