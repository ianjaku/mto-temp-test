import {
    ILanguageOperationUserAction,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { APIMultiInsertUserAction } from "./api";

export const addLanguageUserAction = (
    userActionType: UserActionType,
    languageCode: string,
    binderId: string,
    userId: string,
    accountId: string,
): Promise<void> => {
    const userAction: ILanguageOperationUserAction = {
        accountId,
        userId,
        userActionType,
        data: {
            languageCode,
            itemKind: "binder",
            itemId: binderId,
        },
    };
    return APIMultiInsertUserAction([userAction], accountId);
}