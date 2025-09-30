output "functions" {
  value = {
    screenshots : join("", ["https://", azurerm_linux_function_app.main.default_hostname])
  }
}

output "identity_id" {
  value = azurerm_linux_function_app.main.identity.0.principal_id
}

output "id" {
  value = azurerm_linux_function_app.main.id
}

output "name" {
  value = azurerm_linux_function_app.main.name
}
