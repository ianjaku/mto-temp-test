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
  subscription_id = "df893890-4da6-47bc-8a71-2ec64776511a"
}

