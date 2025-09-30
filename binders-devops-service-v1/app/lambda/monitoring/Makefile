build:
	sam build

provision:
	sam deploy

validate:
	sam validate

deploy: validate build provision

invoke-azure:
	sam local invoke AzureMonitorFunction

invoke-prom:
	sam local invoke PrometheusMonitorFunction

invoke-reader:
	sam local invoke ReaderMonitorFunction

run-azure: build invoke-azure

run-prom: build invoke-prom
