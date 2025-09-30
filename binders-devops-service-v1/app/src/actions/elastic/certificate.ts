import type { KubeConfig } from "@kubernetes/client-node";
import { base64decode } from "../../lib/base64";
import { getSecret } from "../k8s/secrets";
import { log } from "../../lib/logging";

interface ElasticTlsCertConfig {
    key: string
    kubeConfig: KubeConfig
    namespace: string
    secretName: string
}

export async function getElasticTlsCertificate(config: ElasticTlsCertConfig): Promise<string> {
    const { key, kubeConfig, namespace, secretName } = config
    log("Getting elastic tls secret...")
    const secret = await getSecret(kubeConfig, namespace, secretName)
    return base64decode(secret.data[key])
}
