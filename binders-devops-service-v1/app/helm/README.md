# Global value
In your values file, if you have a top-level key `global` it will be accessibel in all the shared dependencies under `.Values.global`

# Helm hooks

## Info

A helm hook is a kubernetes job that can be plugged into the deployment process. The job definition will have some helm specific annotations that allow extra configuration.

## Types
* pre-install: Executes after templates are rendered, but before any resources are created in Kubernetes.
* post-install: Executes after all resources are loaded into Kubernetes
* pre-delete: Executes on a deletion request before any resources are deleted from Kubernetes.
* post-delete: Executes on a deletion request after all of the release’s resources have been deleted.
* pre-upgrade: Executes on an upgrade request after templates are rendered, but before any resources are loaded into Kubernetes (e.g. before a Kubernetes apply operation).
* post-upgrade: Executes on an upgrade after all resources have been upgraded.
* pre-rollback: Executes on a rollback request after templates are rendered, but before any resources have been rolled back.
* post-rollback: Executes on a rollback request after all resources have been modified.

# Helm templates

## Quoting
When subsituation vars to strings, better to quote them. When using integers, don't quote
```
name: {{ .Values.MyName | quote }}
port: {{ .Values.Port }}
```


## Extra template functions
https://godoc.org/github.com/Masterminds/sprig

## Restart on config change
You can add an annotation to your deployment that will trigger a recreation of a pod when the config changes
```
kind: Deployment
spec:
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
```
The same effect could be achieved by running
```
helm upgrade --recreate-pods
```

## Skip deletion of a resource
When helm delete runs it will delete all resources in the chart. Unless you add this annotation to your resource:
```
kind: Secret
metadata:
  annotations:
    "helm.sh/resource-policy": keep
```

## Template reusable snippets
All filenames in the `templates` directory that start with a `_` are considered partial files and are not expected to create Kuberenetes resources.

## Template tests
You can define tests for your templates. These tests are pods that are launched and are expected to exit 0 on success.

## Recommended tags

* heritage: `{{ .Release.Service }}`
* release: `{{ .Release.name }}`
* chart: `{{ .Chart.Name }}-{{ .Chart.Version \| replace "+" "_" }}`
* app: `{{ template "name" . }}`

## Pod templates

* Define images and tags in your values.yaml: e.g. `image: "{{ .Values.redisImage }}:{{ .Values.redisTag }}"`
* Define the pull policy in values.yaml: `imagePullPolicy: {{ .Values.image.pullPolicy }}`
* All pod templates should define selectors

## Dependencies
You can add existing charts to your `requirements.yaml` file. If you do, be sure to run `helm dependency update` for you chart. Example of such a `requirements.yaml` file:
```
dependencies:
- name: redis
  version: 1.1.19
  repository: "@stable"
```

# Binders charts

## Mongo

### Host VM configuration
The default mongo chart does not set any kernel parameters which is recommended for production (see: https://github.com/pkdone/azure-acs-mongodb-demo/blob/master/resources/hostvm-node-configurer-daemonset.yaml)


### Storage services
AKS uses nodes with Managed Disks. Currently it is not possible to attach blob based volumes to a VM with Managed Disks. One consequence is that if you deploy a PersistentVolumeClaim for a StatefulSet that these claims can only only create Managed Disks volumes. The storage class parameters for the volumes should be something like this:

```
  parameters:
    skuName: Standard_LRS
    kind: Managed
    # cachingmode: None
```

The `cachingmode` might be needed or not, to investigate (https://github.com/Azure/AKS/issues/201)

Also note that even if you delete the helm deployment your persistent volumes (and their claims) will not be deleted. You need to clean those up manually.


