import { ICronjobDefinition, buildCronJob, dailyCronSchedule } from "../../actions/k8s/cronjob";
import { PRODUCTION_NAMESPACE } from "../bindersenvironment";
import { dumpAndRunKubeCtl } from "../k8s";
import { getAccountServiceImageTag } from "../../actions/docker/build";
import { getRecentImageTag } from ".";

const createRunScheduledEventsJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDef: ICronjobDefinition = {
        branch,
        name: "run-expiring-accounts-report",
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: "run-expiring-accounts-report",
            image: getAccountServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/account-v1",
                "node",
                "dist/src/scripts/runExpiringAccountsReport.js",
                "-s",
                "alerts@manual.to",
                "-r",
                "cs@manual.to,sales@manual.to",
                "-t",
                "30",
                "-q"
            ],
            mountProductionConfig: true
        }],
        schedule: dailyCronSchedule(8, 8),
        concurrencyPolicy: "Replace",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, "run-scheduled-events", false);
}

export async function createAccountCronjobs(branch: string): Promise<void> {
    const tag = await getRecentImageTag("account", PRODUCTION_NAMESPACE)
    const tags = {
        "account-v1-service": tag
    }
    await createRunScheduledEventsJob(tags, branch);
}