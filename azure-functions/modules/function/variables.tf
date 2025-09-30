#Module variables
variable "environment" {
  type = string
}

variable "location" {
  type    = string
  default = "westeurope"
}

variable "project" {
  type = string
}

variable "tags" {
  type = map(string)
}

variable "function_name" {
  type = string
}

variable "storage_name" {
  type = string
}

variable "app_service_sku" {
  type = string
}

variable "app_settings" {
  type = map(string)
}


variable "principal_id" {
  type = string
}

variable "log_analytics_workspace_id" {
  type = string
}
