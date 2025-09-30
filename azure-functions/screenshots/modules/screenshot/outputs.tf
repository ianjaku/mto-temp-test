output "vault_uri" {
  value = azurerm_key_vault.image_storage_secret.vault_uri
}

output "account_name" {
  value = azurerm_key_vault_secret.account_name.name
}

output "account_name_version" {
  value = azurerm_key_vault_secret.account_name.version
}

output "access_key" {
  value = azurerm_key_vault_secret.access_key.name
}

output "access_key_version" {
  value = azurerm_key_vault_secret.access_key.version
}

output "new_account_name" {
  value = azurerm_key_vault_secret.new_account_name.name
}

output "new_account_name_version" {
  value = azurerm_key_vault_secret.new_account_name.version
}

output "new_access_key" {
  value = azurerm_key_vault_secret.new_access_key.name
}

output "new_access_key_version" {
  value = azurerm_key_vault_secret.new_access_key.version
}
