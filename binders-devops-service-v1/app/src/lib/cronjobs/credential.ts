import { ICronjobDefinition, buildCronJob, weeklySchedule } from "../../actions/k8s/cronjob";
import { PRODUCTION_NAMESPACE } from "../bindersenvironment";
import { dumpAndRunKubeCtl } from "../k8s";
import { getCredentialServiceImageTag } from "../../actions/docker/build";
import { getRecentImageTag } from ".";

const createSAMLCertificateCheckerJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const name = "saml-certificate-expiration-checker";
    const jobDef: ICronjobDefinition = {
        branch,
        name,
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name,
            image: getCredentialServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/credential-v1",
                "node",
                "dist/src/scripts/checkExpiredSAMLCertificates.js"
            ],
            mountProductionConfig: true
        }],
        schedule: weeklySchedule(3, 10, 17),
        concurrencyPolicy: "Replace"
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, name, false)
}

export async function createCredentialCronjobs(branch: string): Promise<void> {
    const tag = await getRecentImageTag("credential", PRODUCTION_NAMESPACE)
    const tags = {
        "credential-v1-service": tag
    }
    await createSAMLCertificateCheckerJob(tags, branch);
}