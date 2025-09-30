# Migration mongodb cluster between k8s clusters

## Basic information

Migration is based on idea with following [post](https://faun.pub/migrating-mongodb-replica-set-between-kubernetes-clusters-with-zero-downtime-ec84148b9422) <br />

Basically we're building connectivity between two k8s clusters, that allow comunication between mongo nodes.
After adding new mongo nodes into existing replicaSet they will be synced automatically. Then we need to just move master node into new cluster. All operation is safe, because we restrict communication on external load balancer services just for outboud ip of k8s cluster.

## Source cluster
source cluster name: mongo-main-service <br />
namespace: production <br />
hostname: mongo-main-service-mongod-0 <br />
subdomain: mongo-main-service-mongodb-service <br />

### list of mongo pods in source cluster:
1. mongo-main-service-mongod-0.mongo-main-service-mongodb-service
2. mongo-main-service-mongod-1.mongo-main-service-mongodb-service
3. mongo-main-service-mongod-2.mongo-main-service-mongodb-service

### list of proxy pods that represents mongo nodes from target cluster:

1. mongo-0-something
2. mongo-1-something
3. mongo-2-something

### list of services:

0. mongo-main-service-mongodb-service (mongo service created by helm deployment)
1. mongo-source-0-public-ip
2. mongo-source-1-public-ip
3. mongo-source-1-public-ip
4. mongo-service-mongodb-service (service for connecting proxy pods)


## Target cluster
Target cluster name: mongo-service <br />
namespace: production <br />
hostname: mongo-service-mongod-0 <br />
subdomain: mongo-service-mongodb-service <br />

### list of mongo pods in target cluster:
1. mongo-service-mongod-0.mongo-service-mongodb-service
2. mongo-service-mongod-1.mongo-service-mongodb-service
3. mongo-service-mongod-2.mongo-service-mongodb-service

### list of proxy pods that represents mongo nodes from source cluster:
1. mongo-0-something
2. mongo-1-something
3. mongo-2-something

### list of services:
0. mongo-main-service-mongodb-service (mongo service created by helm deployment)
1. mongo-target-0-public-ip
2. mongo-target-1-public-ip
3. mongo-target-1-public-ip
4. mongo-service-mongodb-service (service for connecting proxy pods)


## List of steps for test
1. Prepare bootstrap secrets
    - ```kne get secrets -o yaml bootstrap-mongo-main-service > bootstrap.yml```
    - ```kne apply -f bootstrap.yml```
2. Create source cluster 
    - ```dtn src/scripts/mongo/createMongoCluster -n production -e production```
3. Initializes replicaset (Mongo commands section)
4. Insert dummy data (Mongo commands section)
5. Make sure that secondary nodes are synced (Mongo commands section)
6. Create new mongo cluster in sepperate k8s cluster 
    - ```dtn src/scripts/mongo/createMongoCluster -n production -e production -r mongo-service```
7. Run script for create needed resources for k8s sync 
    - ```dtn src/scripts/mongo/syncMongoClusters -s binders-stg-cluster -t manualto-test-cluster```
8. Add new nodes into replicaset. Repeat for all new nodes. 
    - ```rs.add("mongo-service-mongod-0.mongo-service-mongodb-service")```
9. Verify if all nodes are in replicaSet with secondary status 
   - ```rs.status()```
10. Verify if all nodes are synced 
   - ```rs.printSecondaryReplicationStatus()```
11. Follow commands from Move master into new k8s cluster

## List of steps for prod
1. Create new mongo cluster in sepperate k8s cluster 
    - ```dtn src/scripts/mongo/createMongoCluster -n production -e production -r mongo-service```
2. Run script for create needed resources for k8s sync 
    - ```dtn src/scripts/mongo/syncMongoClusters -s binders-stg-cluster -t manualto-test-cluster```
3. Add new nodes into replicaset. Repeat for all new nodes. 
    - ```rs.add("mongo-service-mongod-0.mongo-service-mongodb-service")```
4. Verify if all nodes are in replicaSet with secondary status 
   - ```rs.status()```
5. Verify if all nodes are synced 
   - ```rs.printSecondaryReplicationStatus()```
6. Follow commands from Move master into new k8s cluster


### Move master into new cluster

```
cfg = rs.conf();
cfg.members[0].priority = 0.5;
cfg.members[1].priority = 0.5;
cfg.members[2].priority = 0.5;
cfg.members[3].votes = 1;
cfg.members[3].priority = 1;
cfg.members[4].votes = 1;
cfg.members[4].priority = 1;
cfg.members[5].votes = 1;
cfg.members[5].priority = 1;
rs.reconfig(cfg);
rs.stepDown()
```

### Other Mongo commands

Initialization of replica set
```
rs.initiate({_id: "mongo-main-service", version: 1, members: [
    { _id: 0, host : "mongo-main-service-mongod-0.mongo-main-service-mongodb-service:27017" },
    { _id: 1, host : "mongo-main-service-mongod-1.mongo-main-service-mongodb-service:27017" },
    { _id: 2, host : "mongo-main-service-mongod-2.mongo-main-service-mongodb-service:27017" }
]});
```

Admin user
```
use admin
db.createUser(
  {
    user: "admin",
    pwd: "1234",
    roles: [ { role: "root", db: "admin" } ]
  }
)
```

Example of creation some dummy data
```
db.createCollection("devs")
db.devs.insertMany([
    {name: "Dieter"},
    {name: "Ian"},
    {name: "Tom"},
    {name: "Waldek"},
])
```

Querying secondary nodes in replicaSet
```
db.getMongo().setSecondaryOk()
```




