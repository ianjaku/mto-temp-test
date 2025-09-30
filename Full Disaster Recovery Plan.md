# **![][image1]**

# **Full Disaster Recovery Plan**

## **Document Control**

* **Version:** 1.0  
* **Last updated:** 2025‑06‑02  
* **Owners:** DevOps Team

---

## **1 – Purpose & Objectives**

* Ensure the production AKS platform can be recovered after a disaster within defined business constraints.  
* Protect customer data and minimise downtime.  
* Meet regulatory and contractual requirements.

## **2 – Scope & Exclusions**

| In scope | Out of scope |
| :---- | :---- |
| Internal Kubernetes components, namespaces, workloads, data services hosted in AKS | Azure landing‑zone build & networking  |
| Storage accounts, Key Vaults | End‑user devices, SaaS apps |

## **3 – Definitions**

* **RTO (Recovery Time Objective):** Max acceptable outage → `3h`  
* **RPO (Recovery Point Objective):** Max acceptable data loss → `8h`  
* **BC:** Business Continuity

## **4 – Roles & Responsibilities**

| Role | Responsibility |
| :---- | :---- |
| DR Owner | End‑to‑end plan maintenance & approval |
| On‑call SRE | Execute runbooks, coordinate technical recovery; receives alerts via PagerDuty |
| Dev Team | Validate app‑level recovery |
| Azure Support | Assist with platform‑level escalations |

## **5 – Recovery Objectives (by Tier)**

| Service Tier | Example Components | RTO | RPO |
| :---- | :---- | :---- | :---- |
| **Tier 0 – Critical State‑ful** | Elasticsearch, MongoDb, Redis, Blob Storage |  `3h`  |   `8h` |
| **Tier 1 – Core Platform** | API gateway, Ingress, Core microservices |  `1h` |  `1h` |
| **Tier 2 – Peripheral** | Reporting jobs, monitoring services |  `8h` |  `8h` |

## **6 – System Inventory & Dependencies**

* **AKS Cluster:** binder-prod-cluster (1.30.7)  
* **Namespaces:** production, monitoring, ingress, kyverno, elastic-system  
* **Data Stores:** Elasticsearch, MongoDb, Redis Cache, Azure blob storage  
* **External:** Azure AD, Key Vault, Storage Account, Route 53  
* **Config Management:** Terraform state in Storage Account with RA‑GZRS to configure manualto service app and monitoring components.

## 

## **7 – Backup Strategy**

### **7.1 Backup & Snapshot Matrix**

| Data Asset | Mechanism | Schedule | Target Storage | RPO | Retention | Responsibility |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **MongoDB** (statefulset) | CronJob `mongodump` → gzip → upload | Every 8 h | Azure Storage Account (container **mongo‑backup**) on `managed-premium-zrs-retain` | **8 h** | **60 days** | Platform SRE |
| **Elasticsearch** | CronJob `elasticdump` index snapshots → upload | Every 8 h | Same Storage Account (container **es‑backup**) | **8 h** | **60 days** | Platform SRE |

### 

### **7.2 Storage Class Notes**

Primary databases (Elasticsearch, Mongodb) are using `managed-premium-zrs-retain`  storage class that provides **zone-redundant** disks and retains them when PVCs are deleted. This delivers resilience against zone failure but **does not** protect from logical corruption or accidental deletion. Backups \+ snapshots (above) satisfy true recovery requirements. 

### **7.3 Backup Validation**

| Validation Job | Trigger | Method | Alerting |
| :---- | :---- | :---- | :---- |
| **validateLatestMongoRestore** | Post‑backup (every 8 h) | Ephemeral `mongo` pod restores latest dump, runs read/write smoke query | Prometheus/Alertmanager  |
| **validateLatestElasticRestore** | Post‑backup (every 8 h) | Ephemeral `elasticsearch` pod restores latest snapshot, checks `_cluster/health` & sample query | Prometheus/Alertmanager |

### **7.4 Retention** 

* All backup data (MongoDB, Elasticsearch, and disk snapshots) is retained for a minimum of **60 days**.

## 

## 

## 

## 

## 

## 

## 

## 

## 

## **8 – Storage & Data Protection**

### **8.1 RA‑GZRS Overview**

* All backup storage accounts are configured with **Read‑Access Geo‑Zone‑Redundant Storage (RA‑GZRS)**.  
* Data is written **synchronously** to three availability zones in the primary region (West Europe) and **asynchronously** copied to a single zone in the paired region (North Europe).  
* **Target RPO:** \<15 minutes (Microsoft SLA for cross‑region replication). This aligns with the platform‑wide RPO for stateful data.  
* **Target RTO:** Reads are available immediately via the secondary endpoint; writes resume within \<2 hours after failover.

  ### **8.2 Planned vs Unplanned Maintenance**

| Scenario | Trigger | Action | Expected Impact |
| :---- | :---- | :---- | :---- |
| **Planned maintenance / migration** | Azure‑initiated events, cost optimisation, capacity re‑balancing | Schedule a maintenance window. Execute `az storage account failover` to promote the secondary region. Update DNS CNAMEs and redeploy workloads to paired AKS cluster. | Short write freeze (\<5 min). Reads continue if apps use secondary endpoint. No data loss (synchronous primary‑zone writes). |
| **Unplanned outage** | Zone or region‑wide disruption, critical service incident | SRE triggers storage account failover once outage is confirmed (per Microsoft advisory). | Possible data loss up to **15 min** (last async replication). Writes unavailable until failover completes (\~1 h). Reads can switch to secondary endpoint pre‑failover. |

  ### **8.3 Encryption & Network Access**

* All data encrypted at rest with Microsoft‑managed keys (option to move to CMKs if required).  
* TLS 1.2+ enforced for all data‑plane connections.

  ### **8.4 Governance & Testing**

* **Semi‑annual failover drill** in staging subscription to measure actual RPO/RTO and update runbooks.  
* **Quarterly IAM review** ensuring only break‑glass identities have permission to invoke `Microsoft.Storage/storageAccounts/failover/action`.  
* Retention policy (≥60 days) and encryption settings reviewed every quarter by DR Owner.


  ## **9 – Restoration Procedures**

This runbook assumes the AKS cluster and base infrastructure have already been recreated. AKS cluster and base infrastructure support is outsourced to Krane Labs. Our SLA with them guarantees 24/7 support availability. Please see Annex A for an overview of the DR mechanisms they take.

There are several key components in our k8s cluster that are essential and required for running production services. This guide might be helpful with quickly rebuilding the inside of the production kubernetes cluster.

### **9.1 Database Layer**

1. **MongoDB cluster**  
   To create mongo cluster you need to invoke:

```javascript
yarn workspace @binders/devops-v1 ts-node src/scripts/mongo/createMongoReplicaset -c binder-prod-cluster -n production --mongo-cluster-name main
```

2. **Elasticsearch cluster**  
   To create elasticsearch cluster you need to invoke:

```javascript
yarn workspace @binders/devops-v1 ts-node src/scripts/eck/createCluster -c binder-prod-cluster -n production
```

**9.2 Cache & Session Storage**

* To create redis cluster you need to invoke:

```javascript
yarn workspace @binders/devops-v1 ts-node src/scripts/redis/createHACluster -n binder-prod-cluster --namespace production
```

  ### **9.3 TLS Setup**

* We need to create a cert manager controller to set up `tls-production-secret` Kubernetes secret, which is used in multiple places (including ingress controller, or during creation Ingress object) so it needs to be deployed before app deploy. 

```javascript
yarn workspace @binders/devops-v1 ts-node src/scripts/letsencrypt/createCertManager -n binder-prod-cluster -e production
```

  ### **9.4 Application Deployment**

* Trigger full CI/CD pipeline for the **current release branch** (Bitbucket).  
* Confirm all Deployments reach the desired replica count and readiness probes succeed.

  ### **9.5.1 Restore Elasticsearch Production Data**

  ### **Prerequisites:**

  1\. Working elasticsearch cluster

	**Recovery:**

To start restoring production data from the latest snapshot on elasticsearch cluster we need to invoke the following bash script: 	

```javascript
binders-devops-service-v1/bash/elastic-restore.sh production
```

You can monitor progress with following script

```javascript
binders-devops-service-v1/bash/elastic-restore-watch.sh production
```

### 

### **9.5.2 Restore Mongo Production Data**

	**Prerequisites:**

1. Working mongo cluster (with initialized replica set and user that have enough permission for restore)  
2. Running devops service pod

**Recovery:**

```javascript
yarn workspace @binders/devops-v1 ts-node src/scripts/backup/latestMongoRestore
```

### **9.6 Validation & Handover**

* Run synthetic transaction tests (login, key API calls, write/read round‑trip).  
* Compare data counts vs pre‑incident metrics.

## **10 – DR Testing & Validation**

| Test Type | Frequency | Owner |
| :---- | :---- | :---- |
| Table‑top walkthrough | Quarterly | DR Owner |
| Non‑prod full failover | Semi‑annual | DR Owner |
| Production read‑only toggle | Annual | DR Owner |

## **12 – Communication Plan**

* **Channels:** Slack \#critical-alerts, \#general, \#tech-talk, \#krane-labs.  
* **Escalation path:** On‑call SRE→ CTO.  
* **Customer comms:** Mail \+ outage page  
* **Monitoring & Alerting:** PagerDuty routes critical alerts from Prometheus and AWS Lambda E2E tests (simulated end‑to‑end user‑journey checks hitting production environment) directly to the On‑call SRE  
  

## **14 – Documentation & Version Control**

* Plan stored in `git@bitbucket.org:bindersmedia/manualto.git`.  
* PR template (What/Why/Risk/Testing) mandatory.  
* Changes require approval from DR Owner \+ Platform Lead.

## **15 – Continuous Improvement**

* **Post‑mortems**: within 5 working days; actions added to backlog.  
* **Metrics** tracked: actual RTO/RPO, MTTR.

---

# Annex A: Krane Labs Infrastructure DRP

## **A.1 Scope of Krane Labs Responsibility**

Krane Labs manages the foundational AKS cluster infrastructure and configuration through Infrastructure as Code (IaC). This includes:

### In Scope:

* AKS cluster provisioning and configuration  
* Node pools and scaling groups across availability zones  
* Base Kubernetes system components (CNI, CSI drivers, RBAC)  
* Non-app specific kubernetes componentes (Load Balancers, Ingress controllers, DNS components, …)  
* Non-cluster networking components such as Application Firewalls (WAF) and Hosted DNS  
* Infrastructure networking within the cluster  
* Kubernetes version management and upgrades  
* Infrastructure as Code (IaC) maintenance and execution

### Out of Scope:

* Customer applications and workloads  
* Customer-managed databases (MongoDB, Elasticsearch, Redis)  
* Customer-specific monitoring and alerting systems  
* Azure subscription and account management  
* Application-level disaster recovery procedures

## **A.2 Infrastructure Resilience Design**

### Multi-Zone Architecture:

* Production AKS cluster spans three availability zones within the Azure region  
* Auto-scaling Node pools distributed across all availability zones  
* Single datacenter failure results in automatic workload redistribution to remaining zones  
* Dependent on Azure’s zone-redundancy guarantees

### Infrastructure as Code Management:

* All infrastructure configuration stored in Krane Labs GitHub repository  
* Repository backed up by GitHub’s backup systems  
* Full code copies maintained by all Krane Labs team members assigned to this account  
* Version-controlled infrastructure changes with audit trail and reviews

### Storage Configuration Guidance:

* ### Krane Labs advises customers on available storage class options for Persistent Volume Claims (zone-redundant vs. single-zone)

* ### Provides recommendations for object storage bucket configurations and redundancy options

* ### Final storage configuration decisions remain with the customer based on their specific requirements and budget considerations

## **A.3 Regional Disaster Recovery Procedures**

### **A.3.1 Disaster Scenarios Covered**

#### **Scenario 1: Partial Regional failure**

* #### Most components will auto-recover from a single- or dual-zone failure

* #### Uses existing AKS cluster with auto-healing functionality.

* #### Might need to adapt the configuration to restrict defunct zones depending on the type of outage

* #### Non-zonal-redundant PVC (disks) can’t be started. We recommend to only use Non-zonal-redundant disks for systems where the redundancy is implemented on the application layer, and doesn’t depend on the availability of a single disk.

#### **Scenario 2: Complete Azure Region Failure**

* #### Primary target region: North Europe (Ireland) \- Azure paired region

* #### Alternative regions: Italy North, Sweden Central

  * #### Note: North Europe may experience high demand during West Europe outages due to paired region status

* #### Uses existing Azure subscription with updated region configuration

* #### All disks (PVCs) will need to be restored from snapshots (disk-level) or restored from backups (application-level)

* #### All object store buckets which aren’t replicated to a different region, will need to be restored from backups

#### **Scenario 3: Azure Subscription Compromise**

* ### Requires customer to provision new Azure subscription

* ### Customer must ensure billing account association and grant Krane Labs access

* ### Subscription ID updated in Krane Labs IaC configuration

### **A.3.2 Recovery Process**

#### **Phase 1: Initiation (0–15 minutes)**

1. Customer initiates DR through both communication channels:  
2. Dedicated Slack channel  
3. Emergency phone line  
4. Krane Labs acknowledges receipt (24/7 availability)  
5. Customer confirms disaster scenario and target region preference

#### **Phase 2: Infrastructure Recovery (15 minutes \- 2 to 6 hours)**

**For Same Subscription (Scenarios 1 and 2):**

* Update region configuration value in IaC (Scenario 2\)  
* Execute IaC Planning function to verify changes  
* Apply configuration to new region  
* Validate cluster accessibility and basic functionality

**For New Subscription (Scenario 2):**

* Update subscription ID in IaC configuration  
* Update region configuration if different from original  
* Execute full infrastructure provisioning  
* Validate cluster accessibility and basic functionality

**Note**: The 6 hour scenario is a worst case scenario. The mean time would be between 2 and 4 hours. However, we have to take into account that in case  
of a major Azure outage, the Azure backends might be overloaded and capacity in regions which are available, would be limited.

#### **Phase 3: Handover (2 to 6 \- 8 hours)**

* Confirm AKS cluster is operational with:  
    
- All node pools running and healthy  
- System pods in ready state  
- Kubernetes API accessible  
- Basic networking functionality verified  
* Provide customer with:  
- New cluster connection details  
- Updated kubeconfig if required  
- Confirmation that infrastructure layer is ready for application deployment

## **A.4 Recovery Time Objectives**

For scenario 1, we have a Target RTO \< 2 hours.

For scenarios 2 and 3, the following Target RTO applies:

| Component | Target RTO | Notes |
| :---- | :---- | :---- |
| AKS Cluster Infrastructure | 6 hours | From initiation to handover |
| Network Connectivity | 4 hours | Including DNS updates if required |
| Node Pool Availability | 6 hours | All zones operational |

*Note: RTO begins from customer notification to Krane Labs, not from the initial incident.*

## **A.5 Communication Protocols**

**Primary Communication:**

* Dedicated customer Slack channel for real-time updates  
* Regular status updates every 30 minutes during recovery  
* Immediate notification of any blockers or delays

**Escalation:**

* Krane Labs on-call engineer  
* Engineering team and management involvement for complex scenarios

## **A.6 Prerequisites for Recovery**

**Customer Responsibilities:**

* Maintain valid Azure subscription with appropriate permissions  
* Ensure Krane Labs has necessary Azure RBAC roles  
* For new subscription scenarios: provision subscription and grant access  
* Maintain emergency communication channels

**Technical Prerequisites:**

* Azure region availability in target location  
* Sufficient Azure quota in target region  
* Network connectivity for Krane Labs team

## **A.7 Post-Recovery Validation**

Upon completion, Krane Labs provides:

* Infrastructure validation report  
* Cluster health assessment  
* Performance baseline comparison  
* Handover documentation for customer application recovery

## **A.8 Limitations and Dependencies**

**Azure Dependencies:**

* Recovery time dependent on Azure service availability in target region  
* Azure quota limitations may impact recovery in rare scenarios  
* Cross-region network latency may affect initial performance

**Service Level Agreement:**

* 24/7 emergency response availability  
* Target 8-hour recovery objective (infrastructure only, taking into account reduced availability of Microsoft Azure services during a major outage)  
* Continuous communication during recovery process

**Note:** This plan covers infrastructure recovery only. Customer application recovery, including databases and custom services, follows the procedures outlined in the main disaster recovery document.

[image1]: <data:image/png;base64,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>