# Intro
To follow infrastructure as code approach we choose Terraform as main utility that help us organize Azure resources in particular environments.
With new dev envorinment we sepperated dev infratructure from production for safety reason. Thanks two terrafrom we could create multiple same envs (per team or even per de)
Intrastucture folder structure:
- modules: containes reusable modules across envs
- Environments folders (for now we have big differences between dev and upper envs, so I choose the   simplest solution in terms of resource managment)
    - dev
    - staging
    - production
- scripts: some scripts (e.g for creating custom tf.vars file)
- Makefile: contain all shortcuted terraform command for all envs

Important part of stack is tfvars.json file containing required terraform variables.
File contains multiple service principles for different purposes


```json
{
  "app_sp_identity": "some-guid",
  "owner_identity_id": "some-guid",
  "kv_owner_identities": [
    "some-guid"
  ],
  "kv_read_identities": [
    "some-guids"
  ],
  "kv_secret":
}
```
**app_sp_identity** containes service principal identity used by appilaction to get access to secrets

**owner_identity_id** containes service principal identity that owns resource group that contains all cloud resources

**kv_read_identities** containes service principal that has read access to key-valuts that storing applications secrets

**kv_owner_identities** containes service principal that has full access to key-valuts that storing applications secrets

**kv_secret** contains secrets file that is stored in keyvault


# How to deploy binders-service infrastucture

1. Inside infrastructure run init.sh to create resource group for terraform (if not exists ealier)

2. Use createSecretsTfVarsFile.ts script to get required by Terraform variable files (for desired environment)

3. Inside infrastructure run make infra-${env} e.g make infra-dev to create infrastructure for desired environment

4. Publish azure function code (cd binders-image-service-v1/app/deploy) && yarn run azure-publish-dev

5. Run up.ts


# Up.ts options

Script up.ts working in two modes.

1. Connected to new dev infra create via terraform

2. Connected to old shared infrastructure

To work in second mode you need to have access to staging/production secrets

To run env in second mode you need to use following command:
ts-node up.ts -s true