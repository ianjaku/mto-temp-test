import { HELM_PRODUCTION_MONGO_SERVICE_DIR } from "../../lib/helm";
import { runHelmInstall } from "../helm/install";
import { waitForPods } from "../k8s/pods";


export const setupMongoService = async (mongoReleaseName: string, numberOfNodes: number, namespace: string): Promise<void> => {
    await runHelmInstall(".", mongoReleaseName, HELM_PRODUCTION_MONGO_SERVICE_DIR, undefined, namespace);
    await waitForPods(mongoReleaseName, numberOfNodes, namespace);
};


export async function updateMongoService(mongoReleaseName: string, namespace: string): Promise<void> {
    await runHelmInstall(".", mongoReleaseName, HELM_PRODUCTION_MONGO_SERVICE_DIR, undefined, namespace);
}
