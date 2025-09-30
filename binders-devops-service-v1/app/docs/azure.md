
# Give AKS Service Principal read access to AKS

```
#!/bin/bash

AKS_RESOURCE_GROUP=binders-aks-staging
AKS_CLUSTER_NAME=binders-aks-staging
ACR_RESOURCE_GROUP=docker-registry
ACR_NAME=binders

# Get the id of the service principal configured for AKS
CLIENT_ID=$(az aks show --resource-group $AKS_RESOURCE_GROUP --name $AKS_CLUSTER_NAME --query "servicePrincipalProfile.clientId" --output tsv)

# Get the ACR registry resource id
ACR_ID=$(az acr show --name $ACR_NAME --resource-group $ACR_RESOURCE_GROUP --query "id" --output tsv)

# Create role assignment
az role assignment create --assignee $CLIENT_ID --role Reader --scope $ACR_ID
```

# Create a Service Principal used in the Bitbucket Pipeline for deploys
```
#!/bin/bash

SP_NAME=bitbucket-pipeline
SP_PASSWORD=
AKS_NAME=aks-tom
AKS_RESOURCE_GROUP=$AKS_NAME

AKS_ID=$(az aks show --name $AKS_NAME -g $AKS_RESOURCE_GROUP --query "id" --output tsv)
az ad sp create-for-rbac -n $SP_NAME -p $SP_PASSWORD --scopes $AKS_ID
```

# Login and retrieve kubectl config
```
#!/bin/bash

AZURE_SERVICEPRINCIPAL=bitbucket-pipeline
AZURE_PASSWORD=
AZURE_AD_TENANT=
AZURE_SUBSCRIPTION=

az login --service-principal -u $AZURE_SERVICEPRINCIPAL -p $AZURE_PASSWORD --tenant $AZURE_AD_TENANT
az account set --subscription $AZURE_SUBSCRIPTION
az aks install-cli
az aks get-credentials -g myResourceGroup -n myClusterName
```


# Set up letsencrypt for wildcard certificates with renewal with AzureDNS

- Get the following information:
    - Your subscriptionID ($$AZURE_SUBSCRIPTION_ID$$)
    - Your AD TenantID ($$AZURE_TENANT_ID$$)
    - The resource group containing your DNS zones ($$DNS_RESOURCE_GROUP$$)

- Create a role that can modify TXT DNS records
    - Create file `role.json` with the following content
```
{
  "Name":"DNS TXT Contributor",
  "Id":"",
  "IsCustom":true,
  "Description":"Can manage DNS TXT records only.",
  "Actions":[
    "Microsoft.Network/dnsZones/TXT/*",
    "Microsoft.Network/dnsZones/read",
    "Microsoft.Authorization/*/read",
    "Microsoft.Insights/alertRules/*",
    "Microsoft.ResourceHealth/availabilityStatuses/read",
    "Microsoft.Resources/deployments/read",
    "Microsoft.Resources/subscriptions/resourceGroups/read"
  ],
  "NotActions":[

  ],
  "AssignableScopes":[
    "/subscriptions/<$$AZURE_SUBCRIPTION_ID$$>"
  ]
}
```
    - Run this command to create the role: `az role definition create --role-definition role.json`

- Create a service principal with the correct role
```
az ad sp create-for-rbac --name "Acme2DnsValidator" --role "DNS TXT Contributor" --scopes "/subscriptions/$$AZURE_SUBSCRIPTION_ID$$/resourceGroups/$$DNS_RESOURCE_GROUP$$"
```
This command will output json with 2 new pieces of data you will need in the following steps, i.e. the application ID (appId) and the client secret (password).

- Get the script
```
git clone https://github.com/Neilpang/acme.sh.git /opt/acme.sh
```

- Set up the environment
```
export AZUREDNS_SUBSCRIPTIONID="XYZ"
export AZUREDNS_TENANTID="YZX"
export AZUREDNS_APPID="ZXY"
export AZUREDNS_CLIENTSECRET="BA"
```

- Now run the script
```
/opt/acme.sh/acme.sh --issue --dns dns_azure --dnssleep 10 --force -d foobar.com -d *.foobar.com
```

- Deploy to nginx
```
/opt/acme.sh/acme.sh --install-cert -d foobar.com -d *.foobar.com --fullchain-file /etc/nginx/certs/fullchain.pem --key-file /etc/nginx/certs/privkey.pem --reloadcmd "nginx -t && nginx -s reload"
```

- Renewal through cron
```
00 07 1 * * root /opt/acme.sh/acme.sh "--renew" "--dns" "dns_azure" "--dnssleep" "10" "--force" "-d" "foobar.com" "-d" "*.foobar.com" >> /var/log/acme.sh 2>&1
```