
export type AnyInvalidateEvent =
    AclInvalidateEvent |
    AccountInvalidateEvent |
    CollectionInvalidateEvent |
    DocumentInvalidateEvent |
    UserGroupInvalidateEvent |
    UserInvalidateEvent;

export type InvalidateEventName = AnyInvalidateEvent["name"];

export interface AclInvalidateEvent {
    name: "acl"
    aclId: string;
    accountId: string;
    resourceIds: string[];
}

export interface AccountInvalidateEvent {
    name: "account",
    accountId: string;
}

export interface CollectionInvalidateEvent {
    name: "collection",
    collectionId: string;
}

export interface DocumentInvalidateEvent {
    name: "document",
    documentId: string;
}

export interface UserGroupInvalidateEvent {
    name: "usergroup",
    groupId: string;
    userIds: string[];
}

export interface UserInvalidateEvent {
    name: "user"
    userId: string;
}
