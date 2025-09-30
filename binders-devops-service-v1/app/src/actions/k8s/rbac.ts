import type {
    RbacAuthorizationV1Api,
    V1ClusterRole,
    V1ClusterRoleBinding
} from "@kubernetes/client-node";
import { log } from "../../lib/logging";

const DEVOPS_ROLE = "devops"
const DEVELOPER_ROLE = "developer"
const READER_ROLE = "reader"


const devopsClusterRole: V1ClusterRole = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: {
        name: DEVOPS_ROLE,
    },
    rules: [
        {
            apiGroups: [""],
            resources: ["*"],
            verbs: ["get", "list", "watch", "create", "update", "patch"],
        },
        {
            apiGroups: ["*"],
            resources: ["*"],
            verbs: ["get", "list", "watch", "create", "update", "patch"],
        },
        {
            apiGroups: ["*"],
            resources: ["jobs", "cronjobs", "secrets", "deployments", "replicasets", "configmaps", "services", "ingresses"],
            verbs: ["delete"],
        },

    ],
};

const developerClusterRole: V1ClusterRole = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: {
        name: DEVELOPER_ROLE,
    },
    rules: [
        {
            apiGroups: [""],
            resources: ["*"],
            verbs: ["get", "list", "watch"],
        },
        {
            apiGroups: ["*"],
            resources: ["pods", "deployments", "replicasets"],
            verbs: ["create", "update", "delete"],
        }
    ],
};

const readerClusterRole: V1ClusterRole = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: {
        name: READER_ROLE,
    },
    rules: [
        {
            apiGroups: ["*"],
            resources: ["*"],
            verbs: ["get", "list", "watch", "top"],
        }
    ],
};

async function createOrUpdateClusterRole(clusterRole: V1ClusterRole, rbacApi: RbacAuthorizationV1Api): Promise<void> {
    const clusterRoleName = clusterRole.metadata?.name;
    if (!clusterRoleName) {
        log("ClusterRole name is missing");
        return;
    }

    try {
        await rbacApi.readClusterRole({ name: clusterRoleName });
        await rbacApi.replaceClusterRole({ name: clusterRoleName, body: clusterRole });
        log(`Updated ClusterRole ${clusterRoleName}`);
    } catch (err) {
        if (err.code === 404) {
            await rbacApi.createClusterRole({ body: clusterRole });
            log(`Created ClusterRole ${clusterRoleName}`);
        } else {
            log(`Error processing ClusterRole ${clusterRoleName}:`, err.body.message);
        }
    }
}

async function createOrUpdateClusterRoleBiding(clusterRoleBiding: V1ClusterRoleBinding, rbacApi: RbacAuthorizationV1Api): Promise<void> {
    const clusterRoleBindingName = clusterRoleBiding.metadata?.name;
    if (!clusterRoleBindingName) {
        log("ClusterRoleBinding name is missing");
        return;
    }

    try {
        await rbacApi.readClusterRoleBinding({ name: clusterRoleBindingName })
        await rbacApi.replaceClusterRoleBinding({ name: clusterRoleBindingName, body: clusterRoleBiding });
        log(`Updated ClusterRoleBinding ${clusterRoleBindingName}`);
    } catch (err) {
        if (err.code === 404) {
            await rbacApi.createClusterRoleBinding({ body: clusterRoleBiding });
            log(`Created ClusterRoleBinding ${clusterRoleBindingName}`);
        } else {
            log(`Error processing ClusterRoleBinding ${clusterRoleBindingName}:`, err.body.message);
        }
    }
}


function getClusterRoleBinding(name: string, groupId: string, role: string): V1ClusterRoleBinding {
    return {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "ClusterRoleBinding",
        metadata: {
            name,
        },
        subjects: [
            {
                kind: "Group",
                name: groupId,
                apiGroup: "rbac.authorization.k8s.io",
            },
        ],
        roleRef: {
            kind: "ClusterRole",
            name: role,
            apiGroup: "rbac.authorization.k8s.io",
        },
    };
}

export async function createOrUpdateClusterRoles(rbacApi: RbacAuthorizationV1Api): Promise<void> {
    await createOrUpdateClusterRole(devopsClusterRole, rbacApi);
    await createOrUpdateClusterRole(developerClusterRole, rbacApi);
    await createOrUpdateClusterRole(readerClusterRole, rbacApi);

}

export async function createOrUpdateClusterRoleBindings(devopsGroupId: string, developersGroupId: string, externalGroupId: string, rbacApi: RbacAuthorizationV1Api): Promise<void> {
    const devopsRoleBinding = getClusterRoleBinding(`${DEVOPS_ROLE}-binding`, devopsGroupId, DEVOPS_ROLE)
    const developersRoleBinding = getClusterRoleBinding(`${DEVELOPER_ROLE}-binding`, developersGroupId, DEVELOPER_ROLE)
    const externalRoleBinding = getClusterRoleBinding(`${READER_ROLE}-binding`, externalGroupId, READER_ROLE)

    await createOrUpdateClusterRoleBiding(devopsRoleBinding, rbacApi)
    await createOrUpdateClusterRoleBiding(developersRoleBinding, rbacApi)
    await createOrUpdateClusterRoleBiding(externalRoleBinding, rbacApi)
}