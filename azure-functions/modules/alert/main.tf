locals {
  name_prefix = "${var.project}-${var.environment}"
}

resource "azurerm_resource_group" "main" {
  name     = "${local.name_prefix}-${var.name}-alert"
  location = var.location
}

resource "azurerm_monitor_action_group" "group" {
  name                = "${local.name_prefix}-${var.name}"
  resource_group_name = azurerm_resource_group.main.name
  short_name          = var.action_group_short_name

  webhook_receiver {
    name                    = "call-slack-webhook"
    service_uri             = var.slack_webhook_url
    use_common_alert_schema = false
  }
}


resource "azurerm_monitor_metric_alert" "server_error" {
  name                = "${var.name}-server-error"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [var.function_id]
  description         = "Alert when function fails"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "Http5xx"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 0
  }

  action {
    action_group_id = azurerm_monitor_action_group.group.id
    
  }
}
