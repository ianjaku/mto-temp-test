import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    ILease,
    LEASE_TEST_ERROR_PREFIX,
    acquireLease,
    getLeaseOwner,
    getLeases
} from "../../actions/k8s/lease";
import {
    TOTAL_INTEGRATION_SLOTS,
    TOTAL_PARALLEL_TEST_SLOTS,
    TOTAL_PLAYWRIGHT_SLOTS,
} from "../../lib/bitbucket";
import { deleteK8SNamespace } from "../../actions/k8s/namespaces";
import { getPipelineNamespace } from "../../lib/bindersenvironment";
import { listPods } from "../../actions/k8s/pods";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { shortenCommitRef } from "../../lib/k8s";
import sleep from "@binders/binders-service-common/lib/util/sleep";

type ParsedOptions = {
    branch: string;
    commit: string;
    slot: number;
    doCleanup: string;
    shrinkSlots?: boolean
};
const getOptions = (): ParsedOptions => {
    const programDefinition: IProgramDefinition = {
        branch: {
            long: "branch",
            short: "b",
            description: "The git branch to inspect",
            default: process.env.BITBUCKET_BRANCH,
            kind: OptionType.STRING,
        },
        commit: {
            long: "commit",
            short: "c",
            description: "The git commit to inspect",
            kind: OptionType.STRING,
            default: process.env.BITBUCKET_COMMIT,
            required: true
        },
        slot: {
            long: "slot",
            description: "The parallel slot index",
            default: process.env.TEST_SLOT,
            kind: OptionType.INTEGER,
        },
        doCleanup: {
            long: "doCleanup",
            description: "Clean up the namespace after the test is done",
            kind: OptionType.STRING,
            default: "notSet"
        },
        shrinkSlots: {
            long: "shrinkSlots",
            description: "The parallel slot index",
            kind: OptionType.BOOLEAN,
            default: false
        }
    };
    const parser = new CommandLineParser("deploy", programDefinition);
    const options = parser.parse<ParsedOptions>();
    return {
        ...options,
        commit: shortenCommitRef(options.commit),
    };
}

const LEASE_PREFIX = "e2e-sync-map-";

async function deleteNamespace(namespace: string) {
    try {
        await deleteK8SNamespace(namespace);
        log(`Successfully deleted namespace ${namespace}`);
    } catch (err) {
        log(err.message);
    }
}

async function logPodRestarts(namespace: string) {
    try {
        const pods = await listPods("", namespace);
        for (const pod of pods) {
            const restartCount = Number.parseInt(pod?.status?.containerStatuses[0]?.restartCount || "0");
            if (restartCount > 0) {
                log(`Following pod was restarted: ${JSON.stringify(pod, null, 4)}`);
            }
        }
    } catch (err) {
        log(err.message);
    }
}

const didAllTestsSlotsComplete = (finishedTestSlots: number, shrinkSlots: boolean) => shrinkSlots ? finishedTestSlots === TOTAL_INTEGRATION_SLOTS + TOTAL_PLAYWRIGHT_SLOTS : finishedTestSlots === TOTAL_PARALLEL_TEST_SLOTS;

/**
 * Only check for failed tests when we're at a checkpoint (after a set of parallel tests)
 * This is to prevent clearing out the staging environment before that set of tests completes
 */
const isAtTestsRunCheckpointAndFoundErrors = (finishedSlots: number, leases: ILease[], shrinkSlots: boolean): boolean => {
    const isAtTestsRunCheckpoint =
        finishedSlots === (TOTAL_INTEGRATION_SLOTS + TOTAL_PLAYWRIGHT_SLOTS) || // integration and playwright run together
        didAllTestsSlotsComplete(finishedSlots, shrinkSlots);
    return isAtTestsRunCheckpoint && leases.some(lease => lease.name.startsWith(LEASE_TEST_ERROR_PREFIX));
}

const acquireTestLease = async (namespace: string, slot: number | undefined): Promise<void> => {
    if (slot == null) return;
    const leaseName = `${LEASE_PREFIX}${slot}`;
    log(`Acquiring lease ${leaseName}`);
    const owner = getLeaseOwner(slot);
    await acquireLease(leaseName, owner, namespace);
}

const tryToDeleteNamespace = async (namespace: string, shrinkSlots: boolean): Promise<void> => {
    const leases = await getLeases(namespace);
    const finishedTestSlots = leases.filter(lease => lease.name.startsWith(LEASE_PREFIX)).length;
    if (didAllTestsSlotsComplete(finishedTestSlots, shrinkSlots) || isAtTestsRunCheckpointAndFoundErrors(finishedTestSlots, leases, shrinkSlots)) {
        await logPodRestarts(namespace);
        deleteNamespace(namespace);
        await sleep(5_000);
    } else {
        log(`Tests still running. Only found ${finishedTestSlots} finished slots.`);
    }
}

main(async () => {
    const { commit, doCleanup, slot, shrinkSlots } = getOptions();

    if (doCleanup === "notSet") {
        const namespace = getPipelineNamespace();
        log(`Handle parallel acceptance test, commit ${commit}, slot ${slot}`);
        await acquireTestLease(namespace, slot);
        await tryToDeleteNamespace(namespace, shrinkSlots);
    } else {
        log(`doCleanup flag value: ${JSON.stringify(doCleanup)}`);
        const namespace = getPipelineNamespace(true);
        if (doCleanup === "true") {
            await deleteNamespace(namespace)
        } else {
            log("Skipping cleanup");
        }
    }
})
