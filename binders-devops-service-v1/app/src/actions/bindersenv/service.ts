import { IBindersEnvironment, getNamespace, toK8sService } from "../../lib/bindersenvironment";
import { buildAndRunCommand, buildKubeCtlCommand, runCommand } from "../../lib/commands";
import { extractServiceDeploymentGroups, setServiceDeploymentGroups } from "./deployment";
import { dumpYaml } from "../../lib/yaml";
import { getService } from "../k8s/services";


const addDeploymentGroupAnnotations = async (env: IBindersEnvironment, service, groupId?: string) => {
    const namespace = getNamespace(env);
    const { metadata } = service;
    const serviceName = metadata.name;
    const serviceObject = await getService(serviceName, namespace);
    const groups = extractServiceDeploymentGroups(serviceObject);
    if (groupId) {
        groups[groupId] = {
            selector: service.spec.selector,
            createTime: new Date()
        };
    }
    setServiceDeploymentGroups(service, groups, groupId);
    return service;
}

const dumpServiceYaml = async (env: IBindersEnvironment, serviceName: string, serviceVersion: string, deploymentGroupId?: string) => {
    const targetDirectory = `/tmp/k8s/${env.branch}-service-${serviceName}-${serviceVersion}`;
    await runCommand("mkdir", ["-p", targetDirectory]);
    const targetFile = `${targetDirectory}/env.yml`;
    const service = toK8sService(env, env.services.find(s => s.name === serviceName && s.version === serviceVersion));
    await addDeploymentGroupAnnotations(env, service, deploymentGroupId);
    await dumpYaml(service, targetFile);
    return targetFile;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const updateService = async (env: IBindersEnvironment, serviceName: string, serviceVersion: string, deploymentGroupId?: string) => {
    const namespace = getNamespace(env);
    const serviceYamlFile = await dumpServiceYaml(env, serviceName, serviceVersion, deploymentGroupId);
    const args = ["apply", "-f", serviceYamlFile, "--namespace", namespace];
    return buildAndRunCommand( () => buildKubeCtlCommand(args));
};
