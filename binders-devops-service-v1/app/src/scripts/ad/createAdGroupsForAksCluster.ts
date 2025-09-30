import { CommandLineParser, IProgramDefinition, OptionType, } from "../../lib/optionParser";
import {
    DEVELOPERS_AD_GROUP,
    DEVOPS_AD_GROUP,
    K8S_ADMIN_AD_GROUP,
    createRoleAssignment,
    getK8sClusterObjectId,
    maybeCreateAdGroup
} from  "../../actions/azure/ad";
import { getResourceGroupForCluster } from "../../actions/aks/cluster";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";



interface AdGropsForAksOptions {
    aksClusterName: string
    resourceGroup: string
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true,
            default: "test-rbac"
        },
        resourceGroup: {
            long: "resource-group",
            short: "g",
            description: "The resource group where AKS is deployed",
            kind: OptionType.STRING,
        },
    };
    const parser = new CommandLineParser("AdGroupsForAKS", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as AdGropsForAksOptions;
};

main(async () => {
    const { aksClusterName, resourceGroup } = getOptions()
    const rg =  resourceGroup || getResourceGroupForCluster(aksClusterName)
    
    const developerGroupId = await maybeCreateAdGroup(DEVELOPERS_AD_GROUP)
    const devopsGroupId = await maybeCreateAdGroup(DEVOPS_AD_GROUP)
    const adminGroupId = await maybeCreateAdGroup(K8S_ADMIN_AD_GROUP)
    if (developerGroupId && devopsGroupId) {
        log("Getting cluster object id")
        const clusterObjId = await getK8sClusterObjectId(aksClusterName, rg)
        log("Creating role assignments")
        await createRoleAssignment(devopsGroupId, clusterObjId)
        await createRoleAssignment(developerGroupId, clusterObjId)
        await createRoleAssignment(adminGroupId, clusterObjId)
    } else {
        log("Can't get devops or developers ad group")
    }

})