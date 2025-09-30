


# K8S Node Labels

We will use node labels to determine which nodes will run which K8S components. Below is the full list of values we will use for the `binders-node-role`:

* elastic-production (3x)
* elastic-devops (3x)
* mongo + redis production (3x)
* service-production (6x)

# Command sequence

* Pick the cluster name

```
export AKS_CLUSTER_NAME="<INSERT_YOUR_CHOICE>"
```

* Create the AKS cluster

```
ts-node src/scripts/aks/createAKSCluster.ts -n $AKS_CLUSTER_NAME --location westeurope --number-of-nodes 15 --instance-disk-size 128
```

* Enable the kubernetes dashboard and pipeline user
```
ts-node src/scripts/aks/setupDevops.ts -n $AKS_CLUSTER_NAME
```

* Install helm

```
ts-node src/scripts/helm/install.ts -n $AKS_CLUSTER_NAME
```

* Install the ingress controller
```
helm install stable/nginx-ingress --tls --name nginx-ingress-controller --set rbac.create=true
```

* Create the elastic clusters
```
ts-node src/scripts/elastic/setupElasticCluster.ts -n binders
ts-node src/scripts/elastic/setupElasticCluster.ts -n logevents
```

* Create the mongo cluster
```
ts-node src/scripts/mongo/createMongoReplicaset.ts -n $AKS_CLUSTER_NAME --mongo-cluster-name main --k8s-label mongo-main
ts-node src/scripts/mongo/createAllServiceUsers.ts -n $AKS_CLUSTER_NAME --mongo-cluster-name main
```

* Create the redis cluster
```
ts-node src/scripts/redis/createHACluster.ts -n $AKS_CLUSTER_NAME --redis-cluster-name default --namespace production --k8s-label redis-main
```

* Deploy the microservices
```
ts-node src/scripts/bindersenv/deploy.ts -c $AKS_CLUSTER_NAME -b master
```
