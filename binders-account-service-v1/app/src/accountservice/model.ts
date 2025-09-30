import {
    AG5Settings,
    IAccountSettings,
    ILanguageAccountSettings,
    IMTAccountSettings,
    IPDFExportAccountSettings,
    ISAMLSSOSettings,
    IVisualsAccountSettings,
    SecuritySettings,
    defaultAccountSettings,
} from  "@binders/client/lib/clients/accountservice/v1/contract";
import {
    IMSTransactableEventAction,
    IMSTransactableEventBase,
    IMSTransactableEventCommon,
    IMSTransactableEventInit
} from  "./repositories/ms_transactables/msTransactableEvents";
import {
    IThumbnail,
    MTEngineType
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import { DomainFilter } from "@binders/client/lib/clients/routingservice/v1/contract";
import { Either } from "@binders/client/lib/monad";
import { EntityIdentifier } from "@binders/binders-service-common/lib/model/entities";
import { IAccountSortSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import { InvalidArgument } from "@binders/client/lib/util/errors";
import UUID from "@binders/client/lib/util/uuid";
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { assocPath } from "ramda";

export class AccountIdentifier extends EntityIdentifier<string> {

    private static PREFIX = "aid-";

    protected assert(id: string): void {
        if (!id || !id.startsWith(AccountIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid account id '${id}'`);
        }
    }

    static generate(): AccountIdentifier {
        const id = UUID.randomWithPrefix(AccountIdentifier.PREFIX);
        return new AccountIdentifier(id);
    }

    static build(key: string): Either<Error, AccountIdentifier> {
        try {
            return Either.right<Error, AccountIdentifier>(new AccountIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}

export class CustomerIdentifier extends EntityIdentifier<string> {

    private static PREFIX = "cus-";

    protected assert(id: string): void {
        if (!id || !id.startsWith(CustomerIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid account id '${id}'`);
        }
    }

    static generate(): CustomerIdentifier {
        const id = UUID.randomWithPrefix(CustomerIdentifier.PREFIX);
        return new CustomerIdentifier(id);
    }

    static build(key: string): Either<Error, CustomerIdentifier> {
        try {
            return Either.right<Error, CustomerIdentifier>(new CustomerIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}

export enum SubscriptionType {
    TRIAL,
    STANDARD
}

export class SubscriptionTypes {

    static toString(subscriptionType: SubscriptionType): Either<Error, string> {
        switch (subscriptionType) {
            case (SubscriptionType.TRIAL):
                return Either.right("trial");
            case (SubscriptionType.STANDARD):
                return Either.right("standard");
            default: {
                const error = new InvalidArgument(`Invalid subscription enum type ${subscriptionType}`);
                return Either.left(error);
            }
        }
    }

    static toStringUnsafe(subscriptionType: SubscriptionType): string {
        return SubscriptionTypes.toString(subscriptionType).caseOf({
            left: error => { throw error; },
            right: str => str
        });
    }

    static toEnum(subscriptionTypeAsString: string): Either<Error, SubscriptionType> {
        switch (subscriptionTypeAsString) {
            case ("trial"):
                return Either.right(SubscriptionType.TRIAL);
            case ("standard"):
                return Either.right(SubscriptionType.STANDARD);
            default: {
                const error = new InvalidArgument(`Invalid subscription string type ${subscriptionTypeAsString}`);
                return Either.left(error);
            }
        }
    }

    static toEnumUnsafe(subscriptionTypeAsString: string): SubscriptionType {
        return SubscriptionTypes.toEnum(subscriptionTypeAsString).caseOf({
            left: error => { throw error; },
            right: typeEnum => typeEnum
        });
    }
}

export class Account {
    constructor(
        public id: AccountIdentifier,
        public name: string,
        public members: Array<UserIdentifier>,
        public subscriptionType: SubscriptionType,
        public subscriptionId: string,
        public created: Date,
        public expirationDate: Date,
        public readerExpirationDate?: Date,
        public accountIsNotExpired: boolean = false,
        public amIAdmin: boolean = false,
        public domainFilters: Array<DomainFilter> = [],
        public thumbnail?: IThumbnail,
        public rootCollectionId?: string,
        public storageDetails?: IAccountStorageDetails,
        public isAnonymised?: boolean
    ) {

    }

    static create(
        name: string,
        subscriptionType: SubscriptionType,
        expirationDate: Date,
        readerExpirationDate: Date,
        id?: string,
    ): Account {
        const accountId = id ? new AccountIdentifier(id) : AccountIdentifier.generate();
        return new Account(
            accountId,
            name,
            [],
            subscriptionType,
            undefined,
            new Date(),
            expirationDate,
            readerExpirationDate,
            false,
            false,
            []
        );
    }
}

export class Customer {
    constructor(
        public id: CustomerIdentifier,
        public name: string,
        public accountIds: Array<AccountIdentifier>,
        public crmCustomerId: string,
        public created: Date,
    ) {
    }

    static create(
        name: string,
        crmCustomerId?: string,
        id?: string,
    ): Customer {
        const customerId = id ? new CustomerIdentifier(id) : CustomerIdentifier.generate();
        return new Customer(
            customerId,
            name,
            [],
            crmCustomerId,
            new Date(),
        );
    }
}

export interface IAccountStorageDetails {
    deletedVisualsSize: number,
    dirty: boolean,
    inUseVisualsSize: number
}

export class AccountLicensing {
    constructor(
        public accountId: string,
        public totalPublicDocuments: number,
        public maxPublicCount: number,
        public totalLicenses: number,
        public maxNumberOfLicenses: number,
    ) { }
}

export interface AccountMembership {
    accountId: string,
    memberCount: number,
    manualToMemberCount: number,
    start: Date,
    end?: Date,
    id?: string,
}

export class AccountSettings {

    constructor(readonly settings: IAccountSettings) {
    }

    private setValue(completeUpdateKey: string, value: unknown): AccountSettings {
        if (!completeUpdateKey) {
            throw new Error("Update key cannot be empty or nullish");
        }
        const updatePath = completeUpdateKey.split(".");
        return new AccountSettings(assocPath(updatePath, value, this.settings));
    }

    setLanguageSettings(languageSettings: ILanguageAccountSettings): AccountSettings {
        return this.setValue("languages", languageSettings);
    }

    setPDFExportSettings(settings: IPDFExportAccountSettings): AccountSettings {
        return this.setValue("pdfExport", settings);
    }

    setMTSettings(settings: IMTAccountSettings): AccountSettings {
        return this.setValue("mt", settings);
    }

    setMTLanguagePair(languageCodesSerialized: string, engineType: MTEngineType | null): AccountSettings {
        const mtSettings = this.getMTSettings();
        if (engineType === null) {
            delete mtSettings.pairs[languageCodesSerialized];
        } else {
            mtSettings.pairs[languageCodesSerialized] = engineType;
        }
        return this.setMTSettings(mtSettings);
    }

    setSSOSettings(ssoSettings: ISAMLSSOSettings): AccountSettings {
        return this.setValue("sso.saml", ssoSettings);
    }

    getSSOSettings(): ISAMLSSOSettings {
        return this.settings.sso.saml;
    }

    setDefaultVisualSettings(visualSettings: IVisualsAccountSettings): AccountSettings {
        return this.setValue("visuals", visualSettings);
    }

    getDefaultLanguageSettings(): ILanguageAccountSettings {
        return {
            ...defaultAccountSettings().languages,
            defaultCode: this.settings.languages.defaultCode,
            interfaceLanguage: this.settings.languages.interfaceLanguage,
        } as ILanguageAccountSettings;
    }
    getPDFExportSettings(): IPDFExportAccountSettings {
        const defaultPDFExportSettings = {
            renderOnlyFirstCarrouselItem: false,
        };
        return this.settings.pdfExport || defaultPDFExportSettings;
    }
    getMTSettings(): IMTAccountSettings {
        return this.settings.mt;
    }
    setUserTokenSecret(value: string): AccountSettings {
        return this.setValue("userTokenSecret", value);
    }
    getSortSettings(): IAccountSortSettings {
        return this.settings.sorting;
    }
    setSortSettings(value: IAccountSortSettings): AccountSettings {
        return this.setValue("sorting", value);
    }
    getSecuritySettings(): SecuritySettings {
        return this.settings.security;
    }
    setSecuritySettings(value: SecuritySettings): AccountSettings {
        return this.setValue("security", value);
    }
    getHtmlHeadContent(): string {
        return this.settings.htmlHeadContent;
    }
    setHtmlHeadContent(value: string): AccountSettings {
        return this.setValue("htmlHeadContent", value);
    }
    getAG5Settings(): AG5Settings {
        return this.settings.ag5 || { apiKey: undefined };
    }
    setAG5Settings(value: AG5Settings): AccountSettings {
        return this.setValue("ag5", value);
    }
}

export class MSAccountSetupRequest {
    constructor(
        public purchaseIdToken: string,
        public transactableId: string,
        public subscriptionId: string,
        public offerId: string,
        public planId: string,
        public tenantId: string,
        public quantity: number,
        public firstName: string,
        public lastName: string,
        public phone: string,
        public companyName: string,
        public companySite: string,
        public email: string,
        public isDeleted: boolean = false
    ) { }
}

export abstract class MSTransactableEvent implements IMSTransactableEventBase {
    protected constructor(
        public readonly action: IMSTransactableEventAction,
        public subscriptionId: string,
        public offerId: string,
        public planId: string,
        public quantity: number
    ) { }
}

export class MSTransactableEventCommon
    extends MSTransactableEvent
    implements IMSTransactableEventCommon {
    constructor(
        public readonly action: "Reinstate" | "ChangePlan" | "ChangeQuantity" | "Suspend" | "Unsubscribe",
        public operationId: string,
        public activityId: string,
        public subscriptionId: string,
        public offerId: string,
        public publisherId: string,
        public planId: string,
        public quantity: number,
        public timeStamp: string,
        public status: "InProgress" | "NotStarted" | "Failed" | "Succeeded" | "Conflict",
    ) {
        super(
            action,
            subscriptionId,
            offerId,
            planId,
            quantity
        );
    }
}

export class MSTransactableEventInit
    extends MSTransactableEvent
    implements IMSTransactableEventInit {
    public readonly action = "Init" as const;
    constructor(
        public purchaseIdToken: string,
        public transactableId: string,
        public subscriptionId: string,
        public offerId: string,
        public planId: string,
        public tenantId: string,
        public quantity: number,
        public firstName: string,
        public lastName: string,
        public phone: string,
        public companyName: string,
        public companySite: string,
        public email: string
    ) {
        super(
            "Init",
            subscriptionId,
            offerId,
            planId,
            quantity
        );
    }
}

export class MSTransactableSubscription {
    constructor(
        public accountId: string,
        public subscriptionId: string
    ) { }
}

export interface AccountMigrationLog {
    runId: string;
    fromAccountId: string;
    toAccountId: string;
    migratedEntity: string;
    details: Record<string, unknown>;
}