import { AssigneeGroup, AssigneeType } from "@binders/client/lib/clients/authorizationservice/v1/contract";


export const getAssignees = (
    accountId: string,
    assigneeType: AssigneeType,
    assigneeId: string,
    fetchGroupIds: (accountId: string, userId: string) => Promise<string[]>
): Promise<AssigneeGroup[]> => {
    switch (assigneeType) {
        case AssigneeType.USER:
            return getUserAssignees(
                assigneeId,
                accountId,
                fetchGroupIds
            );
        case AssigneeType.PUBLIC:
            return Promise.resolve(
                [publicAssignee()]
            );
        default:
            return Promise.resolve([
                {type: assigneeType, ids: [assigneeId]},
                publicAssignee()
            ]);
    }
}

const getUserAssignees = async (
    userId: string,
    accountId: string,
    fetchGroupIds: (accountId: string, userId: string) => Promise<string[]>
): Promise<AssigneeGroup[]> => {
    const userGroups = await fetchGroupIds(accountId, userId);
    const userGroupAssignees = userGroups.map(
        id => toAssigneeGroup(AssigneeType.USERGROUP, id)
    );
    return [
        ...userGroupAssignees,
        toAssigneeGroup(AssigneeType.USER, userId),
        publicAssignee()
    ];
}

const toAssigneeGroup = (type: AssigneeType, id: string): AssigneeGroup =>  {
    return {
        type,
        ids: [id]
    };
}

const publicAssignee = (): AssigneeGroup => {
    return {
        type: AssigneeType.PUBLIC,
        ids: []
    };
}
