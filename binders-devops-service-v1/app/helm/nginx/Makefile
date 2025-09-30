update-repo:
	helm repo update

set-k8s-staging-context:
	kubectl config use-context binder-stg-cluster-admin

set-k8s-prod-context:
	kubectl config use-context binder-prod-cluster-admin

install-staging: set-k8s-staging-context update-repo
	helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress -f config/staging.yaml

upgrade-staging: set-k8s-staging-context update-repo
	helm upgrade ingress-nginx ingress-nginx/ingress-nginx --namespace ingress -f config/staging.yaml

install-prod: set-k8s-prod-context update-repo
	helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress -f config/production.yaml

upgrade-prod: set-k8s-prod-context update-repo
	helm upgrade ingress-nginx ingress-nginx/ingress-nginx --namespace ingress -f config/production.yaml
