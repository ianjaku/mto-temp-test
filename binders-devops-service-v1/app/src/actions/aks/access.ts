import { createK8SSecretFromFiles } from "../k8s/secrets";
import { createPasswdFile } from "../../lib/htpasswd";
import { getDevopsConfig } from "../../lib/config";
import { getK8SNamespaces } from "../k8s/namespaces";
import log from "../../lib/logging";
import { sequential } from "../../lib/promises";
import { unlinkSync } from "fs";

export const HTPASSWD_SECRET = "dev-users-basic-auth";

export const setupBasicAuth = async (): Promise<void> => {
    const { users } = await getDevopsConfig();
    const htpasswdFile = await createPasswdFile(users);
    const existingNamespaces: string[] = (await getK8SNamespaces())
        .map(ns => ns.metadata.name);
    const namespaces: string[] = ["default", "kube-system", "monitoring", "production"]
        .filter(ns => existingNamespaces.indexOf(ns) > -1);
    await sequential(
        async (ns) => {
            log(`Creating auth secret in namespace '${ns}'`);
            await createK8SSecretFromFiles(HTPASSWD_SECRET, { auth: htpasswdFile }, ns, true);
        },
        namespaces
    )
    unlinkSync(htpasswdFile);
};

export async function createHtpasswdFile(filePath: string): Promise<void> {
    const { users } = await getDevopsConfig();
    await createPasswdFile(users, filePath);
}