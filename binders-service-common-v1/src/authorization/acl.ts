import {
    PermissionName,
    ResourceGroup,
    ResourcePermission,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";

export abstract class ResourceDefinition {
    abstract getPermissions(): Array<PermissionName>;
    abstract getType(): ResourceType;

    constructor(readonly id: string) { }

    getResource(): ResourcePermission {
        const resource: ResourceGroup = {
            type: this.getType(),
            ids: [this.id]
        };
        const permissions = this.getPermissions().map(name => Object.assign({}, { name }));
        return {
            resource,
            permissions
        };
    }
}

export class PermissionFactory {

    public readDocument(bindersId: string): ResourcePermission {
        return (new ReadDocumentPermission(bindersId)).getResource();
    }

    public editDocument(bindersId: string): ResourcePermission {
        return (new EditDocumentPermission(bindersId)).getResource();
    }

    public deleteDocument(bindersId: string): ResourcePermission {
        return (new DeleteDocumentPermission(bindersId)).getResource();
    }

}

export const factoryInstance = new PermissionFactory();
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getInstance = () => factoryInstance;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class PublishDocumentPermission extends ResourceDefinition {
    getPermissions() { return [PermissionName.PUBLISH]; }
    getType() { return ResourceType.DOCUMENT; }
}

class ReadDocumentPermission extends ResourceDefinition {
    getPermissions() { return [PermissionName.VIEW]; }
    getType() { return ResourceType.DOCUMENT; }
}

class EditDocumentPermission extends ResourceDefinition {
    getPermissions() { return [PermissionName.EDIT]; }
    getType() { return ResourceType.DOCUMENT; }
}

class DeleteDocumentPermission extends ResourceDefinition {
    getPermissions() { return [PermissionName.DELETE]; }
    getType() { return ResourceType.DOCUMENT; }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class CreateDocumentPermission extends ResourceDefinition {
    getPermissions() { return [PermissionName.CREATE]; }
    getType() { return ResourceType.DOCUMENT; }
}