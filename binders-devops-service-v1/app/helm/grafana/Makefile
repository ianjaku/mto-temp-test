
set-k8s-staging-context:
	kubectl config use-context binder-stg-cluster-admin

set-k8s-prod-context:
	kubectl config use-context binder-prod-cluster-admin

set-k8s-minikube-context:
	kubectl config use-context minikube

install-staging: set-k8s-staging-context
	helm install grafana grafana/grafana --namespace monitoring -f config/staging.yaml

upgrade-staging: set-k8s-staging-context
	helm upgrade grafana grafana/grafana --namespace monitoring -f config/staging.yaml

install-prod: set-k8s-prod-context
	helm install grafana grafana/grafana --namespace monitoring -f config/production.yaml

upgrade-prod: set-k8s-prod-context
	helm upgrade grafana grafana/grafana --namespace monitoring -f config/production.yaml

install-dev: set-k8s-minikube-context
	helm install grafana grafana/grafana --namespace monitoring -f config/local.yaml

upgrade-dev: set-k8s-minikube-context
	helm upgrade grafana grafana/grafana --namespace monitoring -f config/local.yaml
