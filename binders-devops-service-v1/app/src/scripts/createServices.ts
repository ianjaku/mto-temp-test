import { IBindersEnvironment, toEncodedK8sService } from "../lib/bindersenvironment";
import { BINDERS_SERVICE_SPECS } from "../config/services";
import { dumpFile } from "../lib/fs";
import { main } from "../lib/program";

main(async () => {
    const branch = "rel-march23";
    const commitRef = "0cc6bf22";
    const env: IBindersEnvironment = {
        branch,
        cluster: "binder-prod-cluster",
        commitRef,
        isProduction: true,
        services: BINDERS_SERVICE_SPECS,
    }
    const items = [];
    for (const serviceSpec of BINDERS_SERVICE_SPECS) {
        items.push( toEncodedK8sService(env, serviceSpec));
    }
    await dumpFile("/tmp/services.yaml", items.join("---\n"));
})