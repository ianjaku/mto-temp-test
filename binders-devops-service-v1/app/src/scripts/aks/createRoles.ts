import { CommandLineParser, IProgramDefinition, OptionType, } from "../../lib/optionParser";
import { DEVELOPERS_AD_GROUP, DEVOPS_AD_GROUP, EXTERNAL_READERS, getAdGroupId } from "../../actions/azure/ad";
import { createKubeConfig, createRbacAuthorizationV1Api } from "../../actions/k8s-client/util";
import {
    createOrUpdateClusterRoleBindings,
    createOrUpdateClusterRoles
} from "../../actions/k8s/rbac";
import { main } from "../../lib/program";

interface RbacOptions {
    aksClusterName: string
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
    };
    const parser = new CommandLineParser("Rbac", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as RbacOptions;
};

async function createRbacApi(clusterName: string) {
    const kc = await createKubeConfig(clusterName, { useAdminContext: true });
    return createRbacAuthorizationV1Api(kc);
}

main(async () => {
    const { aksClusterName } = getOptions()
    const developersGroupObjectId = await getAdGroupId(DEVELOPERS_AD_GROUP)
    const devopsGroupObjectId = await getAdGroupId(DEVOPS_AD_GROUP)
    const externalGroupObjectId = await getAdGroupId(EXTERNAL_READERS)
    const rbacApi = await createRbacApi(aksClusterName)
    await createOrUpdateClusterRoles(rbacApi)
    await createOrUpdateClusterRoleBindings(devopsGroupObjectId, developersGroupObjectId, externalGroupObjectId, rbacApi)
})