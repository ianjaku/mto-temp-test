set-k8s-prod-context:
	kubectl config use-context binder-prod-cluster-admin

fetch-terraform-outputs:
	yarn workspace @binders/devops-v1 tsx src/scripts/keyvault/fetchTerraformOutputs

create-prometheus-values-prod:
	yarn workspace @binders/devops-v1 tsx src/scripts/monitoring/createPrometheusValuesFile

add-prometheus-helm-repo:
	helm repo add prometheus-community https://prometheus-community.github.io/helm-charts

install-prod: set-k8s-prod-context fetch-terraform-outputs create-prometheus-values-prod add-prometheus-helm-repo
	helm install prometheus prometheus-community/prometheus --version 22.4.0 -n monitoring -f config/production.yaml

upgrade-prod: set-k8s-prod-context fetch-terraform-outputs create-prometheus-values-prod add-prometheus-helm-repo
	helm upgrade prometheus prometheus-community/prometheus --version 22.4.0 -n monitoring -f config/production.yaml

install-binders-exporter:
	helm install binders prometheus-community/prometheus-elasticsearch-exporter --version 6.7.4 -n monitoring -f config/binders.yaml

upgrade-binders-exporter:
	helm upgrade binders prometheus-community/prometheus-elasticsearch-exporter --version 6.7.4 -n monitoring -f config/binders.yaml

install-logevents-exporter:
	helm install logevents prometheus-community/prometheus-elasticsearch-exporter --version 6.7.4 -n monitoring -f config/logevents.yaml

upgrade-logevents-exporter:
	helm upgrade logevents prometheus-community/prometheus-elasticsearch-exporter --version 6.7.4 -n monitoring -f config/logevents.yaml

install-mongo-exporter-0:
	helm install prometheus-mongodb-exporter-0 prometheus-community/prometheus-mongodb-exporter --version 3.12.1 -n monitoring -f config/mongo0.yaml

upgrade-mongo-exporter-0:
	helm upgrade prometheus-mongodb-exporter-0 prometheus-community/prometheus-mongodb-exporter --version 3.12.1 -n monitoring -f config/mongo0.yaml

install-mongo-exporter-1:
	helm install prometheus-mongodb-exporter-1 prometheus-community/prometheus-mongodb-exporter --version 3.12.1 -n monitoring -f config/mongo1.yaml

upgrade-mongo-exporter-1:
	helm upgrade prometheus-mongodb-exporter-1 prometheus-community/prometheus-mongodb-exporter --version 3.12.1 -n monitoring -f config/mongo1.yaml

install-mongo-exporter-2:
	helm install prometheus-mongodb-exporter-2 prometheus-community/prometheus-mongodb-exporter --version 3.12.1 -n monitoring -f config/mongo2.yaml

upgrade-mongo-exporter-2:
	helm upgrade prometheus-mongodb-exporter-2 prometheus-community/prometheus-mongodb-exporter --version 3.12.1 -n monitoring -f config/mongo2.yaml
