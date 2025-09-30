import {
    Client,
    ClientOptions,
    PageIterator,
    PageIteratorCallback
} from "@microsoft/microsoft-graph-client";
import { Group, User } from "@microsoft/microsoft-graph-types";
import { ClientSecretCredential } from "@azure/identity";
import { Logger } from "../util/logging";
import {
    TokenCredentialAuthenticationProvider
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { getUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import "isomorphic-fetch";

export type GraphClientConnectionParams = {
    tenantId: string;
    clientId: string;
    secret: string;
};
type Options = Pick<ClientOptions, "defaultVersion" | "debugLogging">;

const isUser = (data: unknown): data is User => data["@odata.type"] === "#microsoft.graph.user";
const isGroup = (data: unknown): data is Group => data["@odata.type"] === "#microsoft.graph.group";

export type GroupMember = {
    login: string;
    displayName: string;
    firstName: string | undefined;
    lastName: string | undefined;
    upn: string;
    id: string;
}

const userToGroupMember = (user: User): GroupMember => {
    const {
        id,
        displayName,
        givenName: firstName,
        surname: lastName,
        mail,
        userPrincipalName
    } = user;
    const login = mail ?? userPrincipalName;
    return {
        displayName: getUserName({ displayName, firstName, lastName, login }),
        login,
        firstName,
        lastName,
        upn: userPrincipalName,
        id
    };
}

export class MicrosoftGraphApiClient {

    readonly #client: Client;
    readonly #logger: Logger;

    protected constructor(client: Client, logger: Logger) {
        this.#client = client;
        this.#logger = logger;
    }

    /**
     * Expands the group with the provided `groupId` into its user members
     * and all the members of the nested member groups.
     * @param groupId - the id for the group to expand
     */
    async getGroupMembers(groupId: string): Promise<GroupMember[]> {
        const groupMembersById = new Map<string, GroupMember>();
        const groupsAlreadyExplored = new Set<string>();
        const groupsToExplore = [groupId];

        while (groupsToExplore.length > 0) {
            const groupIdToExpand = groupsToExplore.shift();
            groupsAlreadyExplored.add(groupIdToExpand);
            const response = await this.#client.api(`/groups/${groupIdToExpand}/members`)
                .top(999)
                .get();

            const callback: PageIteratorCallback = (data: unknown) => {
                if (isUser(data)) {
                    if (!groupMembersById.has(data.id)) {
                        groupMembersById.set(data.id, userToGroupMember(data));
                    }
                } else if (isGroup(data)) {
                    if (!groupsAlreadyExplored.has(data.id)) {
                        groupsToExplore.push(data.id);
                    }
                } else {
                    this.#logger.warn(`Unexpected group member of type ${data["@odata.type"]} in group ${groupIdToExpand}`, "ms-api-client");
                }
                return true;
            }

            const pageIterator = new PageIterator(this.#client, response, callback);
            await pageIterator.iterate();
        }
        return Array.from(groupMembersById.values());
    }

    async getUserMemberOfGroupIds(upn: string): Promise<string[]> {
        const groups: string[] = [];

        const response = await this.#client.api(`/users/${upn}/getMemberObjects`)
            .post({ securityEnabledOnly: false });

        const callback: PageIteratorCallback = (data: string) => {
            groups.push(data);
            return true;
        }

        const pageIterator = new PageIterator(this.#client, response, callback);
        await pageIterator.iterate();

        return groups;
    }

    static from({ tenantId, clientId, secret }: GraphClientConnectionParams, logger: Logger, options?: Options): MicrosoftGraphApiClient {
        expectTruthy(tenantId, "tenantId");
        expectTruthy(clientId, "clientId");
        expectTruthy(secret, "secret");
        const credential = new ClientSecretCredential(tenantId, clientId, secret);
        const authProvider = new TokenCredentialAuthenticationProvider(credential, { scopes: ["https://graph.microsoft.com/.default"] });
        const client = Client.initWithMiddleware({
            defaultVersion: options?.defaultVersion ?? "v1.0",
            debugLogging: options?.debugLogging ?? false,
            authProvider,
        });
        return new MicrosoftGraphApiClient(client, logger);
    }
}

function expectTruthy(param: unknown, name: string): void {
    if (!param) throw new Error(`${name} must be a defined`);
}