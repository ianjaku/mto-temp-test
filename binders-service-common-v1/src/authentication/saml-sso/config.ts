import {
    AccountServiceContract,
    ManageMemberTrigger,
    SAMLSSOMode,
    defaultSAMLSSOSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from "../../apiclient/backendclient";
import { RequestHandler, Response } from "express";
import {
    User,
    UserServiceContract,
    UserType
} from "@binders/client/lib/clients/userservice/v1/contract";
import { difference, intersection } from "ramda";
import {
    getAccountIdFromRequestContext,
    getAccountSettingsFromRequestContext
} from "../../middleware/requestContext";
import { AuthenticatedSession } from "@binders/client/lib/clients/model";
import { Config } from "@binders/client/lib/config/config";
import {
    CredentialServiceContract
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import { Logger } from "../../util/logging";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { WebRequest } from "../../middleware/request";
import { getAccountDomain } from "@binders/client/lib/util/domains";

export interface ISAMLSSOConfig {
    pathPrefix: string;
    getAuthenticatedSessionByADIdentity(nameID: string, userAgent: string, tenantId: string): Promise<AuthenticatedSession>;
    registerNewUser(nameID: string, email: string, displayName: string, tenantId: string, accountId: string): Promise<User>;
    setupAccount(tenantId: string, accountId: string, userId: string): Promise<void>;
    refreshGroupMemberships(accountId: string, userId: string, groups: string[], logger: Logger): Promise<void>;
    responseHandler: RequestHandler;
    getLoginRoute(): string;
    getLogoutRoute(): string;
    getResponseRoute(): string;
    getConfiguration(domain: string);
    getSSOModeForConfiguration(configuration): SAMLSSOMode;
}

export class SAMLSSOConfig implements ISAMLSSOConfig {

    private ssoAccountSettings;

    constructor(
        readonly pathPrefix: string,
        private userServiceContract: UserServiceContract,
        private accountServiceContract: AccountServiceContract,
        private credentialServiceContract: CredentialServiceContract,
        private routingServiceContract: RoutingServiceContract,
    ) {

    }

    async getAuthenticatedSessionByADIdentity(nameID: string, userAgent: string, tenantId: string): Promise<AuthenticatedSession> {
        return this.credentialServiceContract.loginByADIdentity(nameID, userAgent, tenantId);
    }

    async setupAccount(tenantId: string, accountId: string, userId: string): Promise<void> {
        await this.validateAccountSSOConfiguration(accountId, tenantId);
        await this.accountServiceContract.addMember(accountId, userId, ManageMemberTrigger.SSO_SAML, true);
    }

    async refreshGroupMemberships(accountId: string, userId: string, groupsFromClaims: string[], logger: Logger): Promise<void> {
        // find all account groups that have mapping
        const allMappedGroups = (await this.credentialServiceContract.getAllADGroupMappings(accountId)).map(({ groupId }) => groupId);
        const accountGroups = (await this.userServiceContract.getGroups(accountId)).map(({ id }) => id);
        logger.info("All mapped groups", "saml-sso", allMappedGroups);
        logger.info("All account groups", "saml-sso", allMappedGroups);
        const accountGroupsWithMappingToAD = intersection(allMappedGroups, accountGroups);

        //secondly we need to know user's membership on AD side
        const userGroupsFromClaims = (await Promise.all(
            groupsFromClaims.map(
                (ADgroupID) => this.credentialServiceContract.getGroupId(ADgroupID, accountId)
            ))).filter(el => el !== undefined);
        const userGroupsInAD = intersection(userGroupsFromClaims, accountGroupsWithMappingToAD);

        // and memberships on application side
        const userGroups = (await this.userServiceContract.getGroupsForUserBackend(userId)).map(({ id }) => id);
        const userGroupsApp = intersection(userGroups, accountGroupsWithMappingToAD);

        // thirdly we create a map to which group we should ADD our user, and from where we should DELETE it
        const groupsToDeleteMembership = difference(userGroupsApp, userGroupsInAD);
        const groupsToAddMembership = difference(userGroupsInAD, userGroupsApp);

        // finally we can do proper add/delete operations to keep in sync with AD!
        await Promise.all(groupsToDeleteMembership.map(groupId =>
            this.userServiceContract.removeGroupMember(accountId, groupId, userId)
        ));
        await Promise.all(groupsToAddMembership.map(groupId =>
            this.userServiceContract.addGroupMember(accountId, groupId, userId)
        ));

    }

    private async validateAccountSSOConfiguration(accountId: string, tenantId: string): Promise<void> {
        const accounts = await this.accountServiceContract.getAccountsForADTenant(tenantId);
        if (accounts.find(a => a.id === accountId) === undefined) {
            throw new Error("SSO is not configured for your account or Active Directory.");
        }
    }

    async registerNewUser(
        nameID: string,
        email: string,
        displayName: string,
        tenantId: string,
        accountId: string,
    ): Promise<User> {
        await this.validateAccountSSOConfiguration(accountId, tenantId);
        const user = await this.userServiceContract.createUser(email, displayName, "", "", UserType.Individual, 1, true);
        await this.accountServiceContract.addMember(accountId, user.id, ManageMemberTrigger.SSO_SAML, true);
        await this.credentialServiceContract.saveADIdentityMapping(nameID, user.id);
        await this.userServiceContract.insertUserTag(
            {
                type: "string",
                id: user.id,
                name: "cdsid",
                value: nameID,
                context: "ad",
            },
            { upsert: true }
        );
        return user;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async getConfiguration(domain: string) {
        const accountDomain = getAccountDomain(domain);
        try {
            const accountId = await getAccountIdFromRequestContext(accountDomain, this.routingServiceContract);
            const { sso: { saml: settings } } = await getAccountSettingsFromRequestContext(accountId, this.accountServiceContract);
            const certificate = await this.credentialServiceContract.getCertificate(accountId);
            return { ...settings, logoutUrl: settings.logout, certificate: certificate.data, accountId };
        } catch (ex) {
            return defaultSAMLSSOSettings();
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    getSSOModeForConfiguration(ssoConfiguration): SAMLSSOMode {
        if (!ssoConfiguration ||
            !ssoConfiguration.tenantId ||
            !ssoConfiguration.enabled) {
            return SAMLSSOMode.DISABLED
        }
        if (ssoConfiguration.autoRedirect) {
            return SAMLSSOMode.SINGLE_AUTH
        }
        return SAMLSSOMode.MULTI_AUTH;
    }

    responseHandler(_request: WebRequest, response: Response): void {
        response.redirect("/");
    }

    getLoginRoute(): string {
        return `${this.pathPrefix}/request`;
    }

    getResponseRoute(): string {
        return `${this.pathPrefix}/response`;
    }

    getLogoutRoute(): string {
        return "/logout";
    }

    static async fromConfig(config: Config, serviceName: string): Promise<SAMLSSOConfig> {
        const [
            userServiceContract,
            accountServiceContract,
            credentialServiceContract,
            routingServiceContract
        ] = await Promise.all([
            BackendUserServiceClient.fromConfig(config, serviceName),
            BackendAccountServiceClient.fromConfig(config, serviceName),
            BackendCredentialServiceClient.fromConfig(config, serviceName),
            BackendRoutingServiceClient.fromConfig(config, serviceName),
        ]);

        return new SAMLSSOConfig("/sso/saml", userServiceContract,
            accountServiceContract, credentialServiceContract, routingServiceContract);
    }

}