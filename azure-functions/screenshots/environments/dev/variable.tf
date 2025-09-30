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

variable "subscription_id" {
  type = string
}

variable "tf_resource_group" {
  type = string
}

variable "tf_storage_account" {
  type = string
}

variable "kv_owner_identities" {
  type = list(string)
}

variable "video_new_storage_account_name" {
  type = string
}

variable "video_new_storage_access_key" {
  type = string
}

variable "video_storage_account_name" {
  type = string
}

variable "video_storage_access_key" {
  type = string
}

variable "tenant_id" {
  type = string
}

variable "slack_webhook_url" {
  type = string
}


variable "development_group_id" {
  type = string
}

variable "log_analytics_workspace_id" {
  type = string
}
