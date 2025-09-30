# Configure the Azure provider
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.20"
    }
  }

  backend "azurerm" {
  }
}

provider "azurerm" {
  features {}
  subscription_id = "93eddcda-b319-4357-9de4-cb610ae0ede9"
}

