# Grafana setup

Before running this helm chart you need to first create following secret, if they not exists in monitoring namespace

```
kubectl create secret generic grafana-azuread-secret \
  --from-literal=GF_AUTH_AZUREAD_CLIENT_ID="<YOUR_CLIENT_ID>" \
  --from-literal=GF_AUTH_AZUREAD_CLIENT_SECRET="<YOUR_CLIENT_SECRET>" \
  -n <YOUR_NAMESPACE>
```

```
kubectl create secret generic grafana-azure-monitor-secret \
  --from-literal=AZURE_TENANT_ID="<YOUR_TENANT_ID>" \
  --from-literal=AZURE_CLIENT_ID="<YOUR_CLIENT_ID>" \
  --from-literal=AZURE_CLIENT_SECRET="<YOUR_CLIENT_SECRET>" \
  --from-literal=AZURE_SUBSCRIPTION_ID="<YOUR_SUBSCRIPTION_ID>" \
  -n <YOUR_NAMESPACE>
```