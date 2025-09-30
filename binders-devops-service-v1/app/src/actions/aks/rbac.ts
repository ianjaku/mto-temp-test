/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { dumpAndRunKubeCtl } from "../../lib/k8s";
import { getProductionCluster } from "./cluster";
import log from "../../lib/logging";
import { runCommand } from "../../lib/commands";


const clusterRoleBinding = (bindingName, roleName, subjects) => ({
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRoleBinding",
    metadata: {
        name: bindingName
    },
    roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: roleName
    },
    subjects
});

// const buildUserClusterRoleBinding = (bindingName, roleName, userEmail) => {
//     const userSubject = {
//         apiGroup: "rbac.authorization.k8s.io",
//         kind: "User",
//         name: userEmail
//     };
//     return clusterRoleBinding(bindingName, roleName, [userSubject]);
// };

const buildGroupClusterRoleBinding = (bindingName: string, roleName: string, groupId: string) => {
    const groupSubject = {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "Group",
        name: groupId
    };
    return clusterRoleBinding(bindingName, roleName, [groupSubject]);
};

export const getAdminGroupId = (clusterName) => {
    if (clusterName === getProductionCluster()) {
        return "63d3bc05-da82-406e-8a92-c4b65012ac6b";
    }
    return "10b86016-27ca-41bc-9f31-4d89f3af185e";
};

export const setAdminUserGroup = async (clusterName, userGroupId) => {
    log(`Assigning group ${userGroupId} to adminster cluster ${clusterName}`);
    const bindingName = `${clusterName}-ad-group-admins`;
    const binding = buildGroupClusterRoleBinding(bindingName, "cluster-admin", userGroupId);
    await dumpAndRunKubeCtl(binding, `rbac-admin-${clusterName}-${userGroupId}`);
};

const buildServiceAccount = (accountName: string, namespace: string) => {
    return {
        apiVersion: "v1",
        kind: "ServiceAccount",
        metadata: {
            name: accountName,
            namespace
        }
    };
};

export const createServiceAccount = async (accountName: string, namespace = "default") => {
    const account = buildServiceAccount(accountName, namespace);
    await dumpAndRunKubeCtl(account, `rbac-service-${accountName}-${namespace}`);
};

export const deleteServiceAccount = async (accountName: string, namespace = "default") => {
    await runCommand("kubectl", [
        "-n", namespace,
        "delete",
        "serviceAccounts", accountName
    ]);
};

export const getClusterAmdinRoleBindingName = (accountName: string) => `cluster-admin-${accountName}`;

const getClusterAdminRoleBinding = (accountName: string, namespace: string) => ({
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRoleBinding",
    metadata: {
        name: getClusterAmdinRoleBindingName(accountName)
    },
    roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: "cluster-admin"
    },
    subjects: [
        {
            kind: "ServiceAccount",
            name: accountName,
            namespace
        }
    ]
});

export const addClusterAdmin = async (accountName: string, namespace = "default") => {
    const roleBinding = getClusterAdminRoleBinding(accountName, namespace);
    await dumpAndRunKubeCtl(roleBinding, `rbac-admin-binding-${accountName}-${namespace}`);
};

export const removeClusterAdmin = async (accountName: string, namespace = "default") => {
    const roleBinding = getClusterAmdinRoleBindingName(accountName);
    await runCommand("kubectl", [
        "-n", namespace,
        "delete",
        "clusterrolebinding", roleBinding
    ]);
};