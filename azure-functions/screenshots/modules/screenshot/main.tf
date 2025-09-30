data "azurerm_client_config" "current" {}

locals {
  name_prefix      = "${var.project}-${var.environment}-v2"
  key_vault_prefix = "${var.project}${var.environment}v2"
}

resource "azurerm_resource_group" "main" {
  name     = "${local.name_prefix}-kv-screenshot-rg"
  location = var.location
}


