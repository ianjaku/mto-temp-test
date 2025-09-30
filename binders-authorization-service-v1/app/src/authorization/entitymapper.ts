import {
    AssigneeGroup,
    AssigneeType,
    ResourceGroup,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { BackendAccountServiceClient, BackendRepoServiceClient, BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersRepositoryServiceContract, DocumentResourceDetails } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { publicAssignee } from "./models/acl";

export function getContainingResourceTypes(resourceType: ResourceType): ResourceType[] {
    switch (resourceType) {
        case ResourceType.DOCUMENT:
            return [ResourceType.DOCUMENT];
        default:
            return [resourceType];
    }
}

export interface EntityMapper {
    getAssignees(assigneeType: AssigneeType, assigneeId: string, accountId?: string): Promise<AssigneeGroup[]>;
    getResources(resourceType: ResourceType, resourceId: string): Promise<ResourceGroup[]>;
    getResourcesArray(resourceType: ResourceType, resourceIds: string[]): Promise<ResourceGroup[]>;
}

export interface EntityMapperFactory {
    forRequest(request): Promise<EntityMapper>;
}

function toAssigneeGroup(type: AssigneeType, id: string): AssigneeGroup {
    return {
        type,
        ids: [id]
    };
}

function toResourceGroup(type: ResourceType, id: string): ResourceGroup {
    return {
        type,
        ids: [id]
    };
}

export class APIEntityMapper implements EntityMapper {

    constructor(
        private readonly accountServiceClient: AccountServiceContract,
        private readonly userServiceClient: UserServiceContract,
        private readonly repositoryServiceClient: BindersRepositoryServiceContract,
        private readonly logger: Logger
    ) {
    }

    getAssignees(assigneeType: AssigneeType, assigneeId: string, accountId?: string): Promise<AssigneeGroup[]> {
        switch (assigneeType) {
            case AssigneeType.USER:
                return this.getUserAssignees(assigneeId, accountId);
            case AssigneeType.PUBLIC:
                return Promise.resolve([publicAssignee()]);
            default:
                return Promise.resolve([
                    {type: assigneeType, ids: [assigneeId]},
                    publicAssignee()
                ]);
        }
    }

    private getDocumentResourceGroups(documentId: string): Promise<ResourceGroup[]> {
        return this.repositoryServiceClient.getDocumentResourceDetails(documentId)
            .then(documentDetails => {
                const groups = [
                    { type: ResourceType.DOCUMENT, ids: Object.keys(documentDetails.ancestorDocuments) }
                ];
                return groups;
            });
    }

    getResources(resourceType: ResourceType, resourceId: string): Promise<ResourceGroup[]> {
        switch (resourceType) {
            case ResourceType.DOCUMENT:
                return this.getDocumentResourceGroups(resourceId);
            default:
                return Promise.resolve([toResourceGroup(resourceType, resourceId)]);
        }
    }

    private extractAncestorIds(documentDetails: DocumentResourceDetails[], resourceId: string): string [] {
        const docDetails = documentDetails.find(d => d.id === resourceId);
        if (!docDetails) {
            return [];
        }
        const { ancestorDocuments } = docDetails;
        const result = new Set<string>();
        const updateResult = (toExtract: string[]) => {
            if (toExtract.length === 0) {
                return;
            }
            toExtract.forEach(toAdd => result.add(toAdd));
            const newToExtract = [];
            for (const toProcess of toExtract) {
                newToExtract.push(...ancestorDocuments[toProcess]);
            }
            updateResult(newToExtract);
        }
        updateResult([resourceId]);
        return Array.from(result);
    }

    async getResourcesArray(resourceType: ResourceType, resourceIds: string[]): Promise<ResourceGroup[]> {
        const documentsDetails = await this.repositoryServiceClient.getDocumentResourceDetailsArray(resourceIds);
        return resourceIds.map((resourceId) => {
            return {
                id: resourceId,
                type: resourceType,
                ids: this.extractAncestorIds(documentsDetails, resourceId)
            };
        });
    }

    private async getUserAssignees(userId: string, accountId?: string): Promise<AssigneeGroup[]> {

        const usergroups = accountId ?
            (await this.userServiceClient.getGroupsForUser(userId, accountId)) :
            (await this.userServiceClient.getGroupsForUserBackend(userId)) ;
        const userGroupAssignees = usergroups.map(group => toAssigneeGroup(AssigneeType.USERGROUP, group.id));
        const result = [
            ...userGroupAssignees,
            toAssigneeGroup(AssigneeType.USER, userId),
            publicAssignee()
        ];
        return result;
    }

    static fromConfig(config: Config, request: WebRequest): Promise<APIEntityMapper> {
        const serviceName = "az-service";
        return Promise.all([
            BackendAccountServiceClient.fromConfig(config, serviceName),
            BackendRepoServiceClient.fromConfig(config, serviceName),
            BackendUserServiceClient.fromConfig(config, serviceName)
        ])
            .then( ([accountClient, repoClient, userClient]) => {
                return new APIEntityMapper(accountClient, userClient, repoClient, request.logger);
            });
    }
}

export class APIEntityMapperFactory implements EntityMapperFactory {

    constructor(private readonly config: Config) { }

    forRequest(request: WebRequest):  Promise<APIEntityMapper> {
        return APIEntityMapper.fromConfig(this.config, request);
    }

    static fromConfig(config: Config): APIEntityMapperFactory {
        return new APIEntityMapperFactory(config);
    }
}

export class InMemoryEntityMapper implements EntityMapper {
    protected assigneeMap: {[id: string]: AssigneeGroup[]};
    protected resourceMap: {[id: string]: ResourceGroup[]};

    constructor() {
        this.assigneeMap = {};
        this.resourceMap = {};
    }

    protected addDocument(documentId: string, collectionId: string): void {
        this.resourceMap[documentId] = [
            {type: ResourceType.DOCUMENT, ids: [collectionId]},
            {type: ResourceType.DOCUMENT, ids: [documentId]}
        ];
    }

    protected addUser(userId: string, accountId: string, groupId?: string): void {
        const assignees = [
            {type: AssigneeType.PUBLIC, ids: []},
            {type: AssigneeType.ACCOUNT, ids: [accountId]},
            {type: AssigneeType.USER, ids: [userId]}
        ];
        if (groupId) {
            assignees.push({type: AssigneeType.USERGROUP, ids: [groupId]});
        }
        this.assigneeMap[userId] = assignees;
    }

    getAssignees(assigneeType: AssigneeType, assigneeId: string): Promise<AssigneeGroup[]> {
        const assignees = this.assigneeMap[assigneeId];
        return Promise.resolve(assignees === undefined ? [] : assignees);
    }

    getResources(resourceType: ResourceType, resourceId: string): Promise<ResourceGroup[]> {
        const resources = this.resourceMap[resourceId];
        return Promise.resolve(resources === undefined ? [] : resources);
    }

    getResourcesArray(resourceType: ResourceType, resourceIds: string[]): Promise<ResourceGroup[]> {
        const result: ResourceGroup[] = resourceIds.reduce((prevValues, resourceId) =>{
            const resources = this.resourceMap[resourceId];
            return [...prevValues, resources];
        }, []);
        return Promise.resolve(result);
    }
}

