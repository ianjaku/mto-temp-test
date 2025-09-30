/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as mongoose from "mongoose";
import {AccountIdentifier, AclIdentifier} from "@binders/binders-service-common/lib/authentication/identity";
import {
    AssigneeGroup,
    AssigneeType,
    IAclRestrictionSet,
    PermissionName,
    ResourcePermission
} from "@binders/client/lib/clients/authorizationservice/v1/contract";



export interface IResourcePermission extends mongoose.Document {
    resourceType: number;
    resourceIds: Array<string>;
    permissions: Array<PermissionName>;
}

export interface IAssignee extends mongoose.Document {
    assigneeType: number;
    assigneeIds: Array<string>;
}

interface IRestrictionSet extends mongoose.Document {
    languageCodes: Array<string>;
}

export interface IAcl extends mongoose.Document {
    aclId: string;
    name: string;
    accountId: string;
    assignees: IAssignee[];
    description: string;
    rules: IResourcePermission[];
    roleId: string;
    restrictionSet?: IRestrictionSet;
}

export interface IAccountPermissionQuery {
    resourceType: number;
    permission: number;
}

export class Acl {

    constructor(
        public id: AclIdentifier,
        public name: string,
        public description: string,
        public accountId: AccountIdentifier,
        public assignees: AssigneeGroup[],
        public rules: ResourcePermission[],
        public roleId: string,
        public restrictionSet: IAclRestrictionSet = undefined,
    ) { }

    addAssignee(assigneeType: AssigneeType, assigneeId: string): Acl {
        const currentAssigneeGroup = this.assignees.find(ass => ass.type === assigneeType);
        const otherAssignees = this.assignees.filter(ass => ass.type !== assigneeType);
        const newAssignees = currentAssigneeGroup === undefined ?
            otherAssignees.concat( [ { type: assigneeType, ids: [assigneeId] } ] ) :
            otherAssignees.concat( [ { type: assigneeType, ids: currentAssigneeGroup.ids.filter(id => id !== assigneeId).concat([assigneeId]) } ] );
        return new Acl(
            this.id,
            this.name,
            this.description,
            this.accountId,
            newAssignees,
            this.rules,
            this.roleId,
            this.restrictionSet,
        );
    }

    private addPublicAssigneeGroup(assignees: AssigneeGroup[]): AssigneeGroup[] {
        const currentAssigneeGroup = assignees.find(ass => ass.type === AssigneeType.PUBLIC);
        if (currentAssigneeGroup !== undefined ) {
            return assignees;
        }
        return assignees.concat([publicAssignee()]);
    }

    addPublicAssignee(): Acl {
        const newAssignees = this.addPublicAssigneeGroup(this.assignees);
        return new Acl(this.id, this.name, this.description, this.accountId, newAssignees, this.rules, this.roleId, this.restrictionSet);
    }

    removePublicAssignee(): Acl {
        const newAssignees = this.assignees.filter(ass => ass.type !== AssigneeType.PUBLIC);
        return new Acl(this.id, this.name, this.description, this.accountId, newAssignees, this.rules, this.roleId, this.restrictionSet);
    }

    getUserAssignees(): string[] {
        const userAssignees = this.assignees.filter(assigneeGroup => assigneeGroup.type === AssigneeType.USER);
        return userAssignees.reduce<string[]>( (reduced, assigneeGroup) => {
            return reduced.concat(assigneeGroup.ids);
        }, []);
    }


    getUsergroupAssignees(): string[] {
        const userAssignees = this.assignees.filter(assigneeGroup => assigneeGroup.type === AssigneeType.USERGROUP);
        return userAssignees.reduce<string[]>( (reduced, assigneeGroup) => {
            return reduced.concat(assigneeGroup.ids);
        }, []);
    }

    removeAssignee(assigneeType: AssigneeType, assigneeId: string): Acl {
        const currentAssigneeGroup = this.assignees.find(ass => ass.type === assigneeType);
        const otherAssignees = this.assignees.filter(ass => ass.type !== assigneeType);
        if (currentAssigneeGroup === undefined) {
            return this;
        }
        const updatedIds = currentAssigneeGroup.ids.filter(id => id !== assigneeId);
        const newAssignees = updatedIds.length > 0 ?
            otherAssignees.concat( [ { type: assigneeType, ids: updatedIds } ] ) :
            otherAssignees;
        return new Acl(this.id, this.name, this.description, this.accountId, newAssignees, this.rules, this.roleId, this.restrictionSet);
    }

    saveRoleId(roleId) {
        return new Acl(this.id, this.name, this.description, this.accountId, this.assignees, this.rules, roleId, this.restrictionSet);
    }

    updateRules(rules) {
        return new Acl(this.id, this.name, this.description, this.accountId, this.assignees, rules, this.roleId, this.restrictionSet)
    }
}


export function publicAssignee(): AssigneeGroup {
    return {
        type: AssigneeType.PUBLIC,
        ids: []
    };
}

