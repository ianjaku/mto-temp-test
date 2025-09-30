import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    buildAndRunCommand,
    buildAzCommand,
    buildKubeCtlCommand,
    runGetKubeCtlConfig
} from  "../../lib/commands";
import { getProductionCluster, getScopeId } from "../../actions/aks/cluster";
import { loadProductionSecrets, loadStagingSecrets } from "../../lib/bindersconfig";
import { getUserAppId } from "../../lib/azure";
import { main } from "../../lib/program";
import { setupBasicAuth } from "../../actions/aks/access";
import { setupMailCredentials } from "../../actions/mail/configure";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        }
    };

    const parser = new CommandLineParser("setupDevops", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any>parser.parse());
};


const allowDashboard = async () => {
    const args = [
        "create", "clusterrolebinding", "kubernetes-dashboard",
        "-n", "kube-system",
        "--clusterrole=cluster-admin",
        "--serviceaccount=kube-system:kubernetes-dashboard"
    ];
    try {
        await buildAndRunCommand(() => buildKubeCtlCommand(args));
    } catch (err) {
        const message = err.output || err.message;
        if (message.indexOf("(AlreadyExists)") === -1) {
            throw err;
        }
    }
};

const createPipelineUser = async (aksClusterName) => {
    const isProduction = aksClusterName === getProductionCluster();
    const secrets = isProduction ?
        await loadProductionSecrets() :
        await loadStagingSecrets();
    const { login, password } = secrets.azure.servicePrincipal.devops;
    const aksScope = await getScopeId(aksClusterName);
    const userAppId = await getUserAppId(login);
    if (userAppId === undefined) {
        const args = [
            "ad", "sp", "create-for-rbac",
            "-n", login,
            "-p", password,
            "--scopes", aksScope
        ];
        await buildAndRunCommand(() => buildAzCommand(args));
    } else {
        const args = [
            "role", "assignment", "create",
            "--assignee", userAppId,
            "--role", "contributor",
            "--scope", aksScope
        ];
        try {
            await buildAndRunCommand(() => buildAzCommand(args));
        } catch (err) {
            const message = err.output || err.message;
            if (message.indexOf("The role assignment already exists") === -1) {
                throw err;
            }
        }
    }
};

const doIt = async () => {
    const { aksClusterName } = getOptions();
    await runGetKubeCtlConfig(aksClusterName);
    await allowDashboard();
    await setupBasicAuth();
    await setupMailCredentials();
    await createPipelineUser(aksClusterName);
};

main(doIt);