import { switchContextExec } from "../utils/kube";

export async function switchContext(rawContext?: string): Promise<void> {
    const { KubeConfig } = await import("@kubernetes/client-node");
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const currentContext = kc.currentContext;
    console.log(`Current context: ${currentContext}`)
    if (!rawContext?.length) return;

    let context: string;
    if (["stg", "staging", "binder-stg-cluster-admin"].includes(rawContext)) {
        context = "binder-stg-cluster-admin";
    }
    else if (["dev", "develop", "development", "minikube"].includes(rawContext)) {
        context = "minikube";
    }

    if (currentContext === context) {
        console.log("Nothing to do");
        return;
    }
    if (!context) throw new Error("Invalid context specified");

    await switchContextExec(context);
    console.log(`Switched context from ${currentContext} to ${context}`);
}
