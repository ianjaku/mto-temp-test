module "function" {
  source          = "../../modules/function"
  environment     = var.environment
  function_name   = "secret-merger"
  storage_name    = "secretmerger"
  app_service_sku = "B1"
  app_settings = {
    "WEBSITE_RUN_FROM_PACKAGE" = 1
    "ENVIRONMENT"              = var.environment
  }
  location                   = var.location
  project                    = var.project
  tags                       = var.tags
  principal_id               = var.development_group_id
  log_analytics_workspace_id = var.log_analytics_workspace_id
}
