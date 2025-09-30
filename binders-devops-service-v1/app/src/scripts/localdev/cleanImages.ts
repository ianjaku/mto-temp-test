import {
    getServicesToBuild as getAllServiceBuildCandidates,
    getLocalServiceImageTag
} from  "../../actions/localdev/build";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { runCommand } from "../../lib/commands";

main(async () => {
    const services = getAllServiceBuildCandidates();
    const tags = services.map(getLocalServiceImageTag);
    log(`Cleaning images: ${tags.join(", ")}`);
    await runCommand("docker", ["rmi", ...tags]);
})