data "azurerm_client_config" "current" {}

locals {
  name         = "${var.project}-${var.environment}-${var.function_name}"
  storage_name = "${var.project}${var.environment}${var.storage_name}"
  share_name   = "assets"
}

resource "azurerm_resource_group" "main" {
  name     = "${local.name}-rg"
  location = var.location
}

resource "azurerm_storage_account" "storage" {
  name                            = local.storage_name
  resource_group_name             = azurerm_resource_group.main.name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  allow_nested_items_to_be_public = false
}

resource "azurerm_storage_share" "function_files" {
  name                 = local.share_name
  quota                = 1
  storage_account_name = azurerm_storage_account.storage.name
}

resource "azurerm_application_insights" "main" {
  name                = local.name
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"
  workspace_id        = var.log_analytics_workspace_id
}

resource "azurerm_service_plan" "main" {
  name                = local.name
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku
}

resource "azurerm_linux_function_app" "main" {
  name                       = local.name
  resource_group_name        = azurerm_resource_group.main.name
  location                   = var.location
  service_plan_id            = azurerm_service_plan.main.id
  storage_account_name       = azurerm_storage_account.storage.name
  storage_account_access_key = azurerm_storage_account.storage.primary_access_key
  https_only                 = true

  site_config {
    application_insights_key               = azurerm_application_insights.main.instrumentation_key
    application_insights_connection_string = azurerm_application_insights.main.connection_string

    application_stack {
      node_version = "20"
    }
  }

  app_settings = var.app_settings
  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_role_assignment" "func-role" {
  scope                = azurerm_linux_function_app.main.id
  role_definition_name = "Contributor"
  principal_id         = var.principal_id
}


resource "azurerm_role_assignment" "app-insights-role" {
  scope                = azurerm_application_insights.main.id
  role_definition_name = "Contributor"
  principal_id         = var.principal_id
}
