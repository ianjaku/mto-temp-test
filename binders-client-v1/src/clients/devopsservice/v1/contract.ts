export interface IServiceSpec {
    name: string;
    version: "v1" | "v2" | "v3";
    port: number;
    replicas?: number;
    isFrontend?: boolean;
    domains?: string[];
    extraIngressPaths?: string[];
    sharedDeployment?: string;
    folder?: string;
}

export interface DeploymentDescriptor {
    branch: string;
    commitRef: string;
}

export interface Deployment extends DeploymentDescriptor {
    deployDate: Date;
    deploymentGroup: string;
    expectedReplicas: number;
    availableReplicas: number;
}

export interface ServiceDeployment {
    spec: IServiceSpec;
    candidates: Deployment[];
    activeDeployment: DeploymentDescriptor;
}

export interface DeploymentGroupItem {
    spec: IServiceSpec;
    deployment: DeploymentDescriptor;
}

export interface DeployedGroup {
    groupId: string;
    items: ServiceDeployment[];
}

export interface DevopsServiceContract {
    deleteDeployment(spec: IServiceSpec, deployment: DeploymentDescriptor): Promise<void>;
    deployGroup(items: DeploymentGroupItem[]): Promise<DeployedGroup>;
    tempLog(msg: string): Promise<void>;
    deployService(spec: IServiceSpec, deployment: DeploymentDescriptor): Promise<ServiceDeployment>;
    getDeployments(): Promise<ServiceDeployment[]>;
    getAllLaunchDarklyFlags(): Promise<{[key: string]: unknown}>
}