import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    ServiceRuntimeInfo,
    restartClient,
    restartCommon,
    restartElastic,
    restartServicesWithInfo,
    restartUiKit
} from "../../actions/localdev/restart";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { SERVICES_NOT_TO_DEPLOY } from "../bindersenv/deploy/shared";
import { main } from "../../lib/program";

interface RestartAllOptions {
    minimalEnvironment: boolean
}

export const getOptions = (): RestartAllOptions => {
    const programDefinition: IProgramDefinition = {
        minimalEnvironment: {
            long: "minimalEnvironment",
            short: "m",
            kind: OptionType.BOOLEAN,
            description: "It's deploying env withouth dashboard, devops, partner",
            default: false
        }
    }
    const parser = new CommandLineParser("RestartAllOptions", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any>parser.parse()) as RestartAllOptions
}

const doIt = async () => {
    const { minimalEnvironment } = getOptions()
    await restartElastic();
    await restartClient();
    await restartUiKit();
    await restartCommon();
    const servicesToCheck: ServiceRuntimeInfo[] = BINDERS_SERVICE_SPECS
        .filter(spec => {
            if (minimalEnvironment) {
                return !SERVICES_NOT_TO_DEPLOY.includes(spec.name)
            }
            return spec
        })
        .filter(s => !s.sharedDeployment)
        .filter(s => s.name !== "static-pages")
        .filter(s => s.name !== "editor" || s.version !== "v1")
        // .filter(s => s.name === "credential")
        .map(s => ({
            serviceName: `${s.name}-${s.version}`,
            status: "waiting",
            restartIteration: 0,
            waitIteration: 1
        }));
    await restartServicesWithInfo(servicesToCheck);
};

main(doIt);