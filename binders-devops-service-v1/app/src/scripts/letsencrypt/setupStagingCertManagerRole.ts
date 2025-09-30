import type {
    KubeConfig,
    V1Role,
    V1RoleBinding
} from "@kubernetes/client-node";
import { createKubeConfig, createRbacAuthorizationV1Api } from "../../actions/k8s-client/util";
import { getStagingCluster } from "../../actions/aks/cluster";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";

async function setupRoles(kubeConfig: KubeConfig): Promise<void> {
    const rbacApi = await createRbacAuthorizationV1Api(kubeConfig);

    const role: V1Role = {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "Role",
        metadata: {
            name: "certificate-manager",
            namespace: "default",
        },
        rules: [
            {
                apiGroups: ["cert-manager.io"],
                resources: ["certificates"],
                verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
            },
        ],
    };

    try {
        await rbacApi.createNamespacedRole({ namespace: "default", body: role });
        log("Role created");
    } catch (err) {
        log("Error creating Role:", err);
    }

    const roleBinding: V1RoleBinding = {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "RoleBinding",
        metadata: {
            name: "certificate-manager",
            namespace: "default",
        },
        roleRef: {
            apiGroup: "rbac.authorization.k8s.io",
            kind: "Role",
            name: "certificate-manager",
        },
        subjects: [
            {
                kind: "ServiceAccount",
                name: "default",
                namespace: "default",
            },
        ],
    };

    try {
        await rbacApi.createNamespacedRoleBinding({ namespace: "default", body: roleBinding });
        log("RoleBinding created");
    } catch (err) {
        log("Error creating RoleBinding:", err);
    }
}


main(async () =>{
    const kubeConfig = await createKubeConfig(getStagingCluster(), { useAdminContext: true });
    await setupRoles(kubeConfig)
})
