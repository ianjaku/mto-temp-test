import {
    AccountServiceContract,
    IFeature
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    AuthorizationServiceContract,
    IAclRestrictionSet,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { ResourceNotFound, Unauthorized } from "@binders/client/lib/clients/model";
import TokenAcl, {
    TOKEN_KEY,
    TokenResourceGroup
} from "@binders/client/lib/clients/authorizationservice/v1/tokenacl";
import { TokenVerifier, UrlTokenData } from "../tokens";
import { BindersConfig } from "../bindersconfig/binders";
import { Maybe } from "@binders/client/lib/monad";
import { WebRequest } from "./request";
import { buildVerifyConfig } from "../tokens/jwt";
import { equals } from "ramda";
import { getAccountFeaturesFromRequestContext } from "./requestContext";
import { getInflatedUserTokenFromRequest } from "../tokens/helpers";
import { isBackendSession } from "./authentication";


export interface Authorization {
    (req: WebRequest, overrideUserIdProvider?: UserIdProvider): Promise<void>;
}

export function MultiAuthorization(candidates: Authorization[], useAndOperator = false): Authorization {
    return useAndOperator ?
        MultiAuthorizationAnd(candidates) :
        MultiAuthorizationOr(candidates);
}

export function MultiAuthorizationOr(candidates: Authorization[]): Authorization {
    return (request: WebRequest) => {
        return candidates.reduce(async (reducedPromise, candidate) => {
            try {
                return await reducedPromise;
            } catch (e) {
                return candidate(request);
            }
        }, Promise.reject(""));
    };
}

export function MultiAuthorizationAnd(candidates: Authorization[]): Authorization {
    return (request: WebRequest) => {
        return candidates.reduce(async (reducedPromise, candidate) => {
            try {
                await reducedPromise;
            } catch (e) {
                return Promise.reject(e);
            }
            return candidate(request);
        }, Promise.resolve());
    }
}

export function AccountFeaturesEnabled(accountService: AccountServiceContract, featureNames: IFeature[]): Authorization {
    return async (request: WebRequest) => {
        const accountId = await extractAccountIdFromParamsOrBodyOrQuery(request);
        const features = await getAccountFeaturesFromRequestContext(accountId, accountService);
        const missingFeatures = featureNames.filter(f => !features.includes(f));
        if (missingFeatures.length) {
            throw new Unauthorized(`Missing features for account ${accountId}: ${missingFeatures.join(", ")}`);
        }
    }
}

export const Allow: Authorization = (_req) => Promise.resolve(undefined);
export const BackendUser: Authorization = (req) => {
    return isBackendSession(req.user) ?
        Promise.resolve(undefined) :
        Promise.reject(new Unauthorized("Backend users only."));
};

export type ResourceGroupExtractorFn = (req: WebRequest) => TokenResourceGroup;

export const buildUrlTokenAuth: (extractResourceGroup: ResourceGroupExtractorFn) => Authorization = (extractResourceGroup: ResourceGroupExtractorFn) => {
    return (async (req) => {
        const token: string = req.query[TOKEN_KEY] as string;
        if (!token) {
            return Promise.reject(new Unauthorized(`Missing token (?${TOKEN_KEY}) in query params`));
        }
        const config = BindersConfig.get();
        const verifyConfig = buildVerifyConfig(config);
        const verifier = new TokenVerifier(verifyConfig);
        // eslint-disable-next-line no-async-promise-executor
        return new Promise<void>(async (resolve, reject) => {
            try {
                const inflatedToken = await verifier.inflate(token);
                if (inflatedToken.isValid()) {
                    const requestedResourceGroup = extractResourceGroup(req);
                    const { acl: { rules } } = (inflatedToken.data as UrlTokenData);
                    const tokenAcl = new TokenAcl(rules);
                    if (tokenAcl.allows(requestedResourceGroup)) {
                        return resolve(undefined);
                    }
                    const errorMessage = `Token url created for ids: [${rules[0].resource.ids}], requested ids: [${requestedResourceGroup.ids}]`;
                    req.logger.error(errorMessage, "token-authorization");

                    return reject(new Unauthorized("urlToken doesn't cover requested item ID"));
                }
            } catch (e) {
                reject(new Unauthorized(e));
            }
        });
    }) as Authorization;
}


export interface RequiredPermission {
    resourceType: ResourceType;
    resourceId: string;
    permission: PermissionName;
    restrictionSet?: IAclRestrictionSet;
}
export type AccountIdExtractor = (request: WebRequest) => Promise<string | undefined>;

export const extractAccountIdFromParams: AccountIdExtractor = async (request): Promise<string | undefined> => (
    request.params?.accountId
);

export const extractAccountIdFromQuery: AccountIdExtractor = async (request) => (
    request.query?.accountId as string
);

export const extractAccountIdFromBody: AccountIdExtractor = async (request): Promise<string | undefined> => (
    request.body?.accountId
);

export const extractAccountIdFromBodyFilter: AccountIdExtractor = async (request): Promise<string | undefined> => (
    request?.body?.filter?.accountId
)

export const extractAccountIdFromParamsOrBody: AccountIdExtractor = async (request): Promise<string | undefined> => (
    await extractAccountIdFromParams(request) ??
    await extractAccountIdFromBody(request)
);

export const extractAccountIdFromParamsOrBodyOrQuery: AccountIdExtractor = async (request): Promise<string | undefined> => (
    await extractAccountIdFromParamsOrBody(request) ??
    await extractAccountIdFromQuery(request)
);

export type AccountsIdsExtractor = (request: WebRequest) => Promise<string[] | undefined>;
export const extractAccountIdsFromBody: AccountsIdsExtractor = async (request): Promise<string[] | undefined> => (
    request.body?.accountIds
);

export function extractBinderIdsFromBody(keyFromBody: string): IdsExtractor {
    return (request) => Promise.resolve(request.body[keyFromBody]);
}

export type IdExtractor = (request: WebRequest) => Promise<string>;
export type LanguagesExtractor = (request: WebRequest) => Promise<IAclRestrictionSet>;
export type IdsExtractor = (request: WebRequest) => Promise<string[]>;
export type RequiredPermissionExtractor = (request: WebRequest) => Promise<Maybe<RequiredPermission>>;

export function extractRequiredPermission(
    resourceType: ResourceType,
    extract: IdExtractor,
    permission: PermissionName,
    restrictionSetExtract?: LanguagesExtractor,
): (request: WebRequest) => Promise<Maybe<RequiredPermission>> {
    return async function(request) {
        try {
            let extractors = [];
            if (restrictionSetExtract) {
                extractors = [extract(request), restrictionSetExtract(request)];
            } else {
                extractors = [extract(request)];
            }
            const [resourceId, restrictionSet] = await Promise.all(extractors);
            return Maybe.just({
                resourceId,
                resourceType,
                permission,
                ...(restrictionSet && { restrictionSet })
            });
        } catch (err) {
            if (err instanceof ResourceNotFound) {
                return Maybe.nothing();
            }
            throw err
        }
    }
}

export function AccountAdmin(
    accountExtractor: IdExtractor,
): RequiredPermissionExtractor {
    return extractRequiredPermission(ResourceType.ACCOUNT, accountExtractor, PermissionName.EDIT);
}

export function AccountAdminBody(azClient: AuthorizationServiceContract): Authorization {
    return authorize(AccountAdmin(extractAccountIdFromBody), azClient);
}

export function AccountAdminBodyFilter(azClient: AuthorizationServiceContract): Authorization {
    return authorize(AccountAdmin(extractAccountIdFromBodyFilter), azClient);
}

export function AccountAdminParams(azClient: AuthorizationServiceContract): Authorization {
    return authorize(AccountAdmin(extractAccountIdFromParams), azClient);
}

export function AccountAdminParamsOrBody(azClient: AuthorizationServiceContract): Authorization {
    return authorize(AccountAdmin(extractAccountIdFromParamsOrBody), azClient);
}

export function AccountAdminParamsOrBodyOrQuery(azClient: AuthorizationServiceContract): Authorization {
    return authorize(AccountAdmin(extractAccountIdFromParamsOrBodyOrQuery), azClient);
}

export function AccountAdminToken(azClient: AuthorizationServiceContract, accountClient: AccountServiceContract): Authorization {
    const requiredPermissionExtractor = AccountAdmin(extractAccountIdFromQuery);
    return authorize(requiredPermissionExtractor, azClient, UserIdFromUserToken, accountClient);
}

const getBindersMediaAccountId = async () => {
    return "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6";
};

export function AccountsEditorMember(azClient: AuthorizationServiceContract, accountIdsExtractor: (request: WebRequest) => string[]): Authorization {
    return async (request) => {
        const user = request.user;
        if (user == null) {
            throw new Unauthorized("Unauthorized.")
        }
        const accounts = await azClient.getAccountsForEditor(user.userId);
        const accountIds = accountIdsExtractor(request);
        if (accountIds == null) {
            throw new Unauthorized("AccountIds not found in body");
        }
        for (const accountId of accountIds) {
            const isAllowed = accounts.some(account => account.accountId === accountId);
            if (!isAllowed) {
                throw new Unauthorized(`User does not have edit permission to account with id ${accountId}`)
            }
        }
    }
}

export function BindersAccountAdmin(azClient: AuthorizationServiceContract): Authorization {
    return authorize(AccountAdmin(async () => getBindersMediaAccountId()), azClient);
}

export function ViewDocument(extract: IdExtractor): RequiredPermissionExtractor {
    return extractRequiredPermission(ResourceType.DOCUMENT, extract, PermissionName.VIEW);
}

export function EditDocument(extract: IdExtractor): RequiredPermissionExtractor {
    return extractRequiredPermission(ResourceType.DOCUMENT, extract, PermissionName.EDIT);
}
export function PublishDocument(extract: IdExtractor): RequiredPermissionExtractor {
    return extractRequiredPermission(ResourceType.DOCUMENT, extract, PermissionName.PUBLISH);
}

export function PublishDocumentAsTranslator(extract: IdExtractor, restrictionSetExtract: LanguagesExtractor): RequiredPermissionExtractor {
    return extractRequiredPermission(ResourceType.DOCUMENT, extract, PermissionName.EDIT, restrictionSetExtract);
}

export function AdminDocument(extract: IdExtractor): RequiredPermissionExtractor {
    return extractRequiredPermission(ResourceType.DOCUMENT, extract, PermissionName.ADMIN);
}

export function ReviewDocument(extract: IdExtractor): RequiredPermissionExtractor {
    return extractRequiredPermission(ResourceType.DOCUMENT, extract, PermissionName.REVIEW);
}

export type UserIdProvider =
    (request: WebRequest, accountServiceContract?: AccountServiceContract) => Promise<string | undefined> | string | undefined;
export const UserIdFromRequest: UserIdProvider = async (request): Promise<string | undefined> =>
    request.user?.userId;
export const DeviceUserIdOrUserIdFromRequest: UserIdProvider = request => request.user?.deviceUserId ?? request.user?.userId;

export const UserIdFromBody: UserIdProvider = async (request): Promise<string | undefined> =>
    request.body?.userId;

export const UserIdFromUserToken: UserIdProvider =
    async (request: WebRequest, accountServiceContract: AccountServiceContract) => {
        const userToken = await getInflatedUserTokenFromRequest(request, accountServiceContract);
        return userToken.data.sub;
    };


/**
 * If available, will use the device user id for the passed authorization steps.
 * Otherwise, will use the default userIdProvider (will usually use req.user.userId).
 * Useful when both the device user and device user target id are needed for authorization, or the service needs the device target user id.
 *
 * Usage:
 *   authorization: asDeviceUserIfAvailable(publicationRead("publicationId"))
 *
 * ! Make sure to pass "useDeviceTargetUserToken" as an option in the client, otherwise the device user token will be used for everything
 */
export function asDeviceUserIfAvailable(authorization: Authorization): Authorization {
    return (req: WebRequest) => {
        return authorization(req, DeviceUserIdOrUserIdFromRequest);
    }
}

export function AccountMember(
    accountServiceContract: AccountServiceContract,
    accountIdExtractor: AccountIdExtractor,
    userIdProvider: UserIdProvider = UserIdFromRequest
): Authorization {
    return AccountsMember(
        accountServiceContract,
        (req) => accountIdExtractor(req).then(Array.of),
        userIdProvider
    );
}

export function AccountsMember(
    accountServiceContract: AccountServiceContract,
    accountsIdsExtractor: AccountsIdsExtractor,
    userIdProvider: UserIdProvider = UserIdFromRequest,
): Authorization {
    return async function(request) {
        const userId = await userIdProvider(request);
        if (!userId) {
            throw new Unauthorized("Not logged in, so no account member check possible");
        }
        const accountIds = await accountsIdsExtractor(request);
        if (!accountIds || !accountIds.length || !accountIds[0]) {
            throw new Unauthorized("No account ids found, so no account member check possible");
        }
        const accounts = await accountServiceContract.findAccountsForIds(accountIds as string[]);

        for (const account of accounts) {
            if (!account.members.includes(userId)) {
                throw new Unauthorized(`User ${userId} not part of account ${account.id}`);
            }
        }
    }
}

/**
 * Checks whether the signed-in user is also the one for which an action is executed or data is fetched
 * @param userIdExtractor - request userId extractor (the userId which is targeted by the action)
 */
export function CurrentUserIsActor(userIdExtractor: (req: WebRequest) => string | undefined): Authorization {
    return async (request: WebRequest) => {
        const userId = request?.user?.userId;
        if (!userId) {
            throw new Unauthorized("No session");
        }
        const actorId = userIdExtractor(request);
        if (actorId && userId !== actorId) {
            throw new Unauthorized("Not a self query");
        }
    }
}

export function MultiDocument(
    authorizationService: AuthorizationServiceContract,
    multiDocExtractor: (request: WebRequest) => Promise<string[]>,
    neededPermission: PermissionName,
    // If true: require access to all resource ids
    // If false: require access to at least 1 of the given ids
    requireAll = true,
    accountKey = "accountId"
): Authorization {
    const resourceType = ResourceType.DOCUMENT;
    return async function(request: WebRequest) {
        const ids = await multiDocExtractor(request)
        if (!ids || !ids.length || !ids[0]) {
            throw new Unauthorized("No ids found, so no find permission check possible");
        }
        const userId = request.user && request.user.userId;
        const accountId = accountIdFromRequest(request, accountKey);
        const resourcesPermissions = await authorizationService.findMultipleResourcesPermissions(userId, resourceType, ids, accountId)
        for (const resourceId in resourcesPermissions) {
            if (requireAll) {
                if (resourcesPermissions[resourceId].find(permission => permission === neededPermission) === undefined) {
                    throw new Unauthorized("You don't have the required permission.")
                }
            } else {
                if (resourcesPermissions[resourceId].find(permission => permission === neededPermission) !== undefined) {
                    return;
                }
            }
        }
        if (!requireAll) {
            throw new Unauthorized("You don't have the required permission.");
        }
    }
}

export const MultiDocumentEdit = (
    authorizationService: AuthorizationServiceContract,
    keyFromBody: string,
    requireAll = true
): Authorization => (
    MultiDocument(
        authorizationService,
        extractBinderIdsFromBody(keyFromBody),
        PermissionName.EDIT,
        requireAll
    )
);

export const MultiDocumentPublish = (
    authorizationService: AuthorizationServiceContract,
    keyFromBody: string
): Authorization => (
    MultiDocument(authorizationService, extractBinderIdsFromBody(keyFromBody), PermissionName.PUBLISH)
);

export const MultiDocumentView = (
    authorizationService: AuthorizationServiceContract,
    keyFromBody: string,
): Authorization => (
    MultiDocument(authorizationService, extractBinderIdsFromBody(keyFromBody), PermissionName.VIEW)
);

export const MultiDocumentAdmin = (
    authorizationService: AuthorizationServiceContract,
    keyFromBody: string,
): Authorization => (
    MultiDocument(authorizationService, extractBinderIdsFromBody(keyFromBody), PermissionName.ADMIN)
);

export const AccountMemberParams = (
    accountServiceContract: AccountServiceContract
): Authorization => (
    AccountMember(accountServiceContract, extractAccountIdFromParams)
);
export const AccountMemberBody = (
    accountServiceContract: AccountServiceContract,
    userIdProvider?: UserIdProvider
): Authorization => (
    AccountMember(accountServiceContract, extractAccountIdFromBody, userIdProvider)
);
export const AccountMemberQuery = (
    accountServiceContract: AccountServiceContract,
): Authorization => (
    AccountMember(accountServiceContract, extractAccountIdFromQuery)
);
export const AccountsMemberBody = (
    accountServiceContract: AccountServiceContract
): Authorization => (
    AccountsMember(accountServiceContract, extractAccountIdsFromBody)
);

export const accountIdFromRequest = (request: WebRequest, accountKey = "accountId"): string | null => {
    const containers = [
        request.query,
        request.body,
        request.params,
        request.body?.filter
    ]
    for (const container of containers) {
        const accountId = container?.[accountKey];
        if (accountId) {
            return accountId;
        }
    }
    return null;
}

export function authorize(
    extractor: RequiredPermissionExtractor,
    azContract: AuthorizationServiceContract,
    userIdProvider: UserIdProvider = DeviceUserIdOrUserIdFromRequest,
    accountContract?: AccountServiceContract,
    accountKey = "accountId"
): Authorization {
    return async function(request: WebRequest, overrideUserIdProvider?: UserIdProvider): Promise<void> {
        if (overrideUserIdProvider) {
            userIdProvider = overrideUserIdProvider;
        }
        const accountId = accountIdFromRequest(request, accountKey);
        if (accountId == null) {
            request.logger.warn("AccountId is null", "authorization");
        }
        const permissionOption = await extractor(request);
        if (permissionOption.isNothing()) {
            return undefined;
        }
        const { resourceType, resourceId, permission, restrictionSet } = permissionOption.get();
        const userId = await userIdProvider(request, accountContract);
        if (restrictionSet && userId) {
            return azContract.findResourcePermissionsWithRestrictions(userId, resourceType, resourceId, accountId)
                .then(permissions => {
                    const permissionWithRestrictionSet = permissions.find(p => {
                        const permissionNames = p.rules[0].permissions.map(({ name }) => name);
                        return (permissionNames.includes(permission)) && equals(p.restrictionSet, restrictionSet);
                    });
                    if (!permissionWithRestrictionSet) {
                        return Promise.reject<void>(new Unauthorized("You don't have the required permission."));
                    }
                    return undefined;
                }, err => {
                    return Promise.reject(err);
                });
        } else {
            return (userId ?
                azContract.findResourcePermissions(userId, resourceType, resourceId, accountId) :
                azContract.findPublicPermissions(resourceType, resourceId, accountId))
                .then(permissions => {
                    if (permissions.find(p => p === permission) === undefined) {
                        return Promise.reject<void>(new Unauthorized("You don't have the required permission."));
                    }
                    return undefined;
                }, err => {
                    request.logger.error(`Ran into an error ${err} ${err.message}`, "authorization")
                    return Promise.reject(err);
                });
        }
    };
}

export const BindersMediaAdmin = (
    azServiceContract: AuthorizationServiceContract,
    userIdProvider: UserIdProvider = UserIdFromRequest,
    accountServiceContract?: AccountServiceContract, // only required when userIdProvider is UserIdFromUserToken
): Authorization => {
    return async function(request: WebRequest): Promise<void> {
        const userId = await userIdProvider(request, accountServiceContract)
        if (!userId) {
            throw new Unauthorized("Not user found. Not logged in?");
        }
        const canAccessBackend = await azServiceContract.canAccessBackend(userId);
        if (!canAccessBackend) {
            throw new Unauthorized("Not a binders media admin");
        }
    }
}

export const authorizeItemIds = (
    itemIdsExtractor: (req: WebRequest) => string[],
    requiredPermissions: PermissionName[],
    azClient: AuthorizationServiceContract
) => {
    return async (req: WebRequest): Promise<void> => {
        if (req.user == null) {
            throw new Unauthorized("No user found.");
        }
        const itemIds = itemIdsExtractor(req);
        const permissions = await azClient.findMultipleResourcesPermissions(
            req.user.userId,
            ResourceType.DOCUMENT,
            itemIds,
            accountIdFromRequest(req)
        );
        for (const itemId of itemIds) {
            if (permissions[itemId] == null) {
                throw new Unauthorized("No permissions returned from authorization service.");
            }
            if (!requiredPermissions.every(rp => permissions[itemId].includes(rp))) {
                throw new Unauthorized(`User does not have sufficient access to item "${itemId}"`);
            }
        }
    }
}

/**
 * Run auth function only when "check" passes
 * works for both Authorization and Authentication
 *
 * Usage: maybe(docEdit("optionalDocId"), req => !!req.params.optionalDocID)
 */
export function maybeAuth<T, Args extends Array<T>>(
    check: (...args: Args) => boolean,
    auth: (...args: Args) => Promise<void>
): (...args: Args) => Promise<void> {
    return async (...args: Args): Promise<void> => {
        if (!check(...args)) return;
        return auth(...args);
    }
}

/**
 * Returns a function that takes a web request and returns whether the given path is available in the body.
 *
 * Usage: isKeyInBody(["user", "firstName"]) -> would return true on ({ user: { firstName: "" }})
 */
export function isKeyInBody(path: string[] | string): (req: WebRequest) => boolean {
    const pathArray = Array.isArray(path) ? path : [path];
    return (req: WebRequest) => {
        return isKeyInObj(pathArray, req.body);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isKeyInObj(path: string[], obj: Record<string, any>): boolean {
    if (path.length === 0) throw new Error("No path given to isKeyInBody")
    const value = obj[path[0]]
    if (value == null) return false;
    if (path.length === 1) return true;
    if (typeof value !== "object") {
        throw new Error("isKeyInObj path is invalid. Reached a non object before ending");
    }
    return isKeyInObj(value, path.slice(1));
}


export async function verifyActorIsAdminOnAllChangedUserAccounts(
    accountServiceContract: AccountServiceContract,
    changedUserId: string,
    actorId: string
): Promise<void> {
    if (!actorId) {
        throw new Unauthorized("Not logged in, so no admin check possible");
    }
    if (changedUserId === actorId) {
        return;  // Does not apply when users are changing own data
    }
    const accountsForAdmin = await accountServiceContract.getAccountsForUser(actorId, { checkForAdminPermission: true });
    const adminAccountIdsForAdmin = accountsForAdmin
        .filter(account => account.amIAdmin)
        .map(account => account.id);

    const accountIds = await accountServiceContract.getAccountIdsForUser(changedUserId);
    const accountIdsWithoutAdminRights = accountIds.filter(accountId => !adminAccountIdsForAdmin.includes(accountId));
    if (accountIdsWithoutAdminRights.length > 0) {
        throw new Unauthorized("Not allowed to change user without having admin permission in all their accounts.");
    }
}
