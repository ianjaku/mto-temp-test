resource "azurerm_key_vault" "image_storage_secret" {
  name                = "${local.key_vault_prefix}videostorage"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = "standard"
  tenant_id           = data.azurerm_client_config.current.tenant_id
}

resource "azurerm_key_vault_access_policy" "owner_policy" {
  for_each     = toset(var.kv_owner_identities)
  key_vault_id = azurerm_key_vault.image_storage_secret.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = each.value

  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete",
    "Recover",
    "Backup",
    "Restore",
    "Purge",
  ]
}

resource "azurerm_key_vault_access_policy" "read_policy" {
  key_vault_id = azurerm_key_vault.image_storage_secret.id
  tenant_id    = var.tenant_id
  object_id    = var.read_identity_id
  secret_permissions = [
    "Get",
    "List"
  ]
}

resource "azurerm_key_vault_secret" "account_name" {
  name         = "${local.key_vault_prefix}-account-name"
  value        = var.video_storage_account_name
  key_vault_id = azurerm_key_vault.image_storage_secret.id
  depends_on = [
    azurerm_key_vault_access_policy.owner_policy,
  ]
}

resource "azurerm_key_vault_secret" "access_key" {
  name         = "${local.key_vault_prefix}-access-key"
  value        = var.video_storage_access_key
  key_vault_id = azurerm_key_vault.image_storage_secret.id
  depends_on = [
    azurerm_key_vault_access_policy.owner_policy,
  ]
}

resource "azurerm_key_vault_secret" "new_account_name" {
  name         = "${local.key_vault_prefix}-new-account-name"
  value        = var.new_video_storage_account_name
  key_vault_id = azurerm_key_vault.image_storage_secret.id
  depends_on = [
    azurerm_key_vault_access_policy.owner_policy,
  ]
}

resource "azurerm_key_vault_secret" "new_access_key" {
  name         = "${local.key_vault_prefix}-new-access-key"
  value        = var.new_video_storage_access_key
  key_vault_id = azurerm_key_vault.image_storage_secret.id
  depends_on = [
    azurerm_key_vault_access_policy.owner_policy,
  ]
}