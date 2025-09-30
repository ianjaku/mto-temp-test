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

variable "action_group_short_name" {
  type = string
}

variable "function_id" {
  type = string
}

variable "function_name" {
  type = string
}

variable "name" {
  type = string
}

variable "slack_webhook_url" {
  type = string
}
