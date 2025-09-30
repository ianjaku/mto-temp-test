.PHONY: apply destroy infra init init-upgrade init-reconfigure lint output plan refresh validate set-nodprod-subscription update-sas

.ONESHELL:

apply: validate
	terraform apply -var-file="tfvars.json"

infra: apply output

init: update-sas init-reconfigure

init-upgrade: update-sas
	terraform init -backend-config=azure.conf --upgrade

init-reconfigure:
	terraform init -backend-config=azure.conf -reconfigure

lint:
	terraform fmt -check

output:
	terraform output -json > outputs.json

plan: validate
	terraform plan -var-file="tfvars.json"

refresh: validate
	terraform apply -refresh-only -var-file="tfvars.json"

set-subscription:
	az account set -s manual-to-prod

validate: set-subscription
	terraform validate

update-sas: set-subscription
	@echo "Fetching new SAS token with dynamic expiry date..."
	@EXPIRY_DATE=$$(date -u +"%Y-%m-%dT%H:%MZ" -d "+1 hour") # Sets the expiry date to one hour ahead in UTC
	@NEW_SAS_TOKEN=$$(az storage account generate-sas --permissions rwdlacupiytfx --account-name binderprodstate --services bfqt --resource-types sco --expiry $$EXPIRY_DATE --https-only --output tsv)
	@echo "New SAS Token: $$NEW_SAS_TOKEN"
	@sed -i '/sas_token=/d' azure.conf
	@echo 'sas_token="'"$$NEW_SAS_TOKEN"'"' >> azure.conf
	@echo "Updated azure.conf with new SAS token."