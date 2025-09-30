import { dumpYaml } from "../../lib/yaml"
import { getKubeCtlDecodedJson } from "../../lib/k8s"
import { runCommand } from "../../lib/commands"
import { tmpdir } from "os"

/*
apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
    name: lease1
spec:
    holderIdentity: Tom
*/
export async function acquireLease(leaseName: string, owner: string, namespace: string, labels?: Record<string, string>): Promise<void> {
    const lease = {
        apiVersion: "coordination.k8s.io/v1",
        kind: "Lease",
        metadata: {
            name: leaseName,
            ...(labels ? { labels } : {})
        },
        spec: {
            holderIdentity: owner
        }
    };
    const ymlFilePath = `${tmpdir}/lease-${leaseName}.yaml`;
    await dumpYaml(lease, ymlFilePath);
    await runCommand("kubectl", ["-n", namespace, "create", "-f", ymlFilePath], { mute: true });
}

export async function getLease(leaseName: string, namespace: string): Promise<ILease | undefined> {
    try {
        const decodedJson = await getKubeCtlDecodedJson(["-n", namespace, "get", "lease", leaseName]);
        return toILease(decodedJson);
    } catch {
        return undefined;
    }
}

export interface ILease {
    name: string;
    owner: string;
    labels?: Record<string, string>;
}

function toILease(k8sLease) {
    const name = k8sLease.metadata.name;
    const labels = k8sLease.metadata.labels || [];
    const owner = k8sLease.spec.holderIdentity;
    return {
        name,
        owner,
        labels
    };
}
export async function getLeases(namespace: string): Promise<ILease[]> {
    const decodedJson = await getKubeCtlDecodedJson(["-n", namespace, "get", "lease"]);
    return decodedJson.items.map(toILease);
}

export async function releaseLease(leaseName: string, namespace: string): Promise<void> {
    await runCommand("kubectl", ["-n", namespace, "delete", "lease", leaseName], { mute: true});
}

export function getLeaseOwner(slot: number): string {
    return `test-runner-${slot}`;
}

export const LEASE_TEST_ERROR_PREFIX = "e2e-test-error-";
export async function acquireTestsErrorLease(namespace: string, slot: number): Promise<void> {
    if (slot == null) return;
    const leaseName = `${LEASE_TEST_ERROR_PREFIX}${slot}`;
    const owner = getLeaseOwner(slot);
    await acquireLease(leaseName, owner, namespace);
}