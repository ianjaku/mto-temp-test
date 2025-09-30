import * as t from "tcomb";
import { PermissionName, ResourceType } from "../../authorizationservice/v1/contract";
import { tcombValidate } from "../../validation";

const ResourceGroupStruct = t.struct({
    name: t.maybe(t.String),
    type: t.enums.of(Object.keys(ResourceType)),
    ids: t.list(t.String),
});

const PermissionStruct = t.struct({
    name: t.enums.of(Object.keys(PermissionName)),
})

const ResourcePermissionStruct = t.struct({
    resource: ResourceGroupStruct,
    permissions: t.list(PermissionStruct),
})

const TokenAclStruct = t.struct({
    rules: t.list(ResourcePermissionStruct)
});

export function validateTokenAcl(candidate: unknown): string[] {
    return tcombValidate(candidate, TokenAclStruct);
}
