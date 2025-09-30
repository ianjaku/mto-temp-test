import { AuthenticatedSession, Unauthorized } from "@binders/client/lib/clients/model";
import {
    User,
    UserCreationMethod,
    UserSearchResult,
    UserServiceContract,
    Usergroup,
    UsergroupDetails,
} from "@binders/client/lib/clients/userservice/v1/contract";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { isUsergroup } from "@binders/client/lib/clients/userservice/v1/helpers";

export class UserRecordsFilter {
    constructor(private readonly userService: UserServiceContract) { }

    private async isRestrictedUser(userId: string) {
        const user = await this.userService.getUser(userId);
        return user.creationMethod === UserCreationMethod.PLG_TRIAL_V1;
    }

    private async filterAuthorizedRecords<Record>(
        session: AuthenticatedSession | undefined,
        records: Record[],
        isAuthorizedPredicate: (r: Record, userId: string) => boolean,
    ) {
        const userId = session?.userId;
        if (!userId) return [];
        if (session?.isBackend) return records;
        if (await this.isRestrictedUser(userId)) {
            return records.filter(u => isAuthorizedPredicate(u, userId));
        }
        return records;
    }

    public filterUserSearchResult = (request: WebRequest) => async (res: UserSearchResult) => ({
        ...res,
        hits: await this.filterUsers(request)(res.hits),
    })

    public filterUsergroupDetails = (request: WebRequest) => (res: UsergroupDetails[]) => Promise.all(res.map(
        async ugd => ({
            ...ugd,
            members: await this.filterUsers(request)(ugd.members),
        })
    ))

    public filterUsers = (request: WebRequest) => (res: User[]) =>
        this.filterAuthorizedRecords(
            request.user, res,
            (user, userId) => user.id === userId,
        );

    public filterUsersOrUsergroups = (request: WebRequest) => (res: (User | Usergroup)[]) =>
        this.filterAuthorizedRecords(
            request.user, res,
            (ug, userId) => isUsergroup(ug) ? true : ug.id === userId,
        )

    public restrictedUserAccess = (getUserId: (req: WebRequest) => string) => async (request: WebRequest) => {
        const userId = getUserId(request);
        if (!request.user?.userId) throw new Unauthorized("Anonymous access not allowed");
        if (request.user?.isBackend) return;
        const actorId = request.user.userId
        if (await this.isRestrictedUser(actorId)) {
            if (actorId !== userId) throw new Unauthorized("Access not allowed");
        }
    }

}
