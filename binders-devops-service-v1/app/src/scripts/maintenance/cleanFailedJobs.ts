import { deleteJobs, getJobs } from "../../actions/k8s/job";
import { getChar } from "../../lib/diff";
import log from "../../lib/logging";
import { main } from "../../lib/program";

const doIt = async () => {
    const namespace = "production";
    const jobs = await getJobs(namespace);
    const oldJobs = jobs
        .filter(j => j.status.failed >= 1)
        .map(j => j.metadata.name);
    log("Jobs to delete:");
    log(JSON.stringify(oldJobs, null, 2));
    const c = await getChar("Proceed with deleting jobs (y/*)");
    if (c === "y") {
        await deleteJobs(oldJobs, namespace);
    } else {
        log("Aborting...");
    }

};

main(doIt);