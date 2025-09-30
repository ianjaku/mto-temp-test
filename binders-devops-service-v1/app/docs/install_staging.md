# Command sequence

* Pick the cluster name

```
export AKS_CLUSTER_NAME="<INSERT_YOUR_CHOICE>"
```

* Create the AKS cluster

```
ts-node src/scripts/aks/createAKSCluster.ts -n $AKS_CLUSTER_NAME --location westeurope --number-of-nodes 5
```

* Enable the kubernetes dashboard
```
 kubectl create clusterrolebinding kubernetes-dashboard -n kube-system --clusterrole=cluster-admin --serviceaccount=kube-system:kubernetes-dashboard
 ```

* Install helm

```
ts-node src/scripts/helm/install.ts -n $AKS_CLUSTER_NAME
```


* Install the ingress controller
```
helm install stable/nginx-ingress --tls --name nginx-ingress-controller --set rbac.create=true
```
