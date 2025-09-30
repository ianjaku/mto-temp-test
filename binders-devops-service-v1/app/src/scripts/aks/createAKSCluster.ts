import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { buildAndRunCommand, buildAzCommand, runGetKubeCtlConfig } from "../../lib/commands";
import { getAdminGroupId, setAdminUserGroup } from "../../actions/aks/rbac";
import { KUBERNETES_VERSION } from "../../lib/k8s";
import { main } from "../../lib/program";

const buildCreateResourceGroupCommand = (location, name) =>
    buildAzCommand([
        "group", "create",
        "--location", location,
        "--name", name
    ]);

interface ICreateClusterCommandParams {
    aksClusterName: string;
    location: string;
    adminGroupId: string;
    numberOfNodes?: number;
    servicePrincipal?: string;
    instanceType?: string;
    instanceDiskSize?: string;
}


const buildCreateClusterCommand = (params: ICreateClusterCommandParams) => {
    const { aksClusterName } = params;
    if (aksClusterName === undefined) {
        throw new Error("Cannot create cluster with an empty name");
    }
    const commandParams = [
        "aks", "create",
        "--name", aksClusterName,
        "--resource-group", aksClusterName,
        "--kubernetes-version", KUBERNETES_VERSION,
        "--aad-server-app-id", "171dc98d-1bbd-4587-9698-a2050ea2cb92",
        "--aad-server-app-secret", "cuAw5lx3zbArxgGEhAjk7+jEQZDJxaAj5I5e+ANztb4=",
        "--aad-client-app-id", "8db77571-234b-4d3a-bd8e-e3c41faf6926",
        "--aad-tenant-id", "276c232d-1bf1-48dc-9acb-675ef2639f43",
        "--generate-ssh-keys"
    ];
    if (params.numberOfNodes) {
        commandParams.push("--node-count", params.numberOfNodes.toString());
    }
    if (params.servicePrincipal) {
        commandParams.push("--admin-username", params.servicePrincipal);
    }
    if (params.instanceType) {
        commandParams.push("--node-vm-size", params.instanceType);
    }
    if (params.instanceDiskSize) {
        commandParams.push("--node-osdisk-size", params.instanceDiskSize);
    }
    return buildAzCommand(commandParams);
};

const runCreateResourceGroup = async ( location, name ) => {
    await buildAndRunCommand(() => buildCreateResourceGroupCommand(location, name));
};

const runCreateCluster = async (params: ICreateClusterCommandParams) => {
    await buildAndRunCommand(() => buildCreateClusterCommand(params));
};

const createCluster = async (params: ICreateClusterCommandParams) => {
    await runCreateResourceGroup(params.location, params.aksClusterName);
    await runCreateCluster(params);
};

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        location: {
            long: "location",
            description: "The azure location",
            kind: OptionType.STRING,
            required: true
        },
        numberOfNodes: {
            long: "number-of-nodes",
            description: "The number of kubernetes nodes",
            kind: OptionType.STRING,
            required: true
        },
        instanceType: {
            long: "instance-type",
            description: "The type of Azure Compute instance to use a cluster node",
            kind: OptionType.STRING
        },
        instanceDiskSize: {
            long: "instance-disk-size",
            description: "The size of the persistent disk attached to each node",
            kind: OptionType.STRING
        },
        servicePrincipal: {
            long: "service-principal",
            description: "The service principal to use as admin",
            kind: OptionType.STRING
        },
        adminGroupId: {
            long: "admin-group-id",
            description: "The Azure AD user group id that will be cluster admins",
            kind: OptionType.STRING
        }
    };

    const parser = new CommandLineParser("createAKSCluster", programDefinition);
    return (<unknown> parser.parse()) as ICreateClusterCommandParams;
};


main( async () => {
    const commandLineOptions = getOptions();
    await createCluster(commandLineOptions);
    const { aksClusterName, adminGroupId } = commandLineOptions;
    const groupId = adminGroupId || getAdminGroupId(aksClusterName);
    await runGetKubeCtlConfig(aksClusterName, true);
    await setAdminUserGroup(aksClusterName, groupId);
});
