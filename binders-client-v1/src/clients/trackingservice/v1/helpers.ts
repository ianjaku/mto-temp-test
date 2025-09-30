import { IUserAction } from "./contract";

export function hashUserAction(userActionType: string, accountId: string, start: string, end: string): string {
    return `${userActionType}_${accountId}_${start}_${end}`;
}

interface WithBinderId {
    binderId: string;
}

export function getUserActionItemId(userAction: IUserAction): string {
    const { data } = userAction;
    return data.itemId || (data as WithBinderId).binderId;
}