import { IBindersEnvironment, runCommandInContainer, toHostConfig } from "../../lib/bindersenvironment";
import { log } from "../../lib/logging";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const seedEnvironment = async (environment: IBindersEnvironment) => {
    if (environment.isProduction && !environment.testProductionMode) {
        log("Skip seeding for now");
        return;
    }
    log("Seeding environment.");
    const service = "manage";
    const hostConfig = toHostConfig(environment);
    const exec = `yarn workspace @binders/manage-v1 node dist/src/scripts/seeds/staging.js ${hostConfig.manualto}`;
    const serviceSpec = environment.services.find(s => s.name === service);
    if (serviceSpec === undefined) {
        throw new Error(`Could not find service with name ${service}`);
    }
    await runCommandInContainer(environment, serviceSpec, exec);
};