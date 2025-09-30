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

variable "kv_owner_identities" {
  type = list(string)
}

variable "read_identity_id" {
  type = string
}

variable "video_storage_account_name" {
  type = string
}

variable "video_storage_access_key" {
  type = string
}

variable "new_video_storage_account_name" {
  type = string
}

variable "new_video_storage_access_key" {
  type = string
}

variable "tenant_id" {
  type = string
}