import * as mongoose from "mongoose";
import {
    IAccountSettings,
    defaultAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { AccountSettings } from "../model"
import { Logger } from "@binders/binders-service-common/lib/util/logging"
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema"

export interface AccountSettingsRepository {
    getAccountSettings(accountId: string): Promise<AccountSettings>;
    multiGetAccountSettings(accountIds: string[]): Promise<{ [accountId: string]: AccountSettings }>;
    saveAccountSettings(accountId: string, settings: IAccountSettings): Promise<void>;
    findAccountIdForAzureTenant(tenantId: string): Promise<string>;
    findAccountIdsForADTenant(tenantId: string): Promise<string[]>;
}

interface IAccountSettingsMongoose extends mongoose.Document, IAccountSettings {
    accountId: string;
}

const getAccountSettingsSchema: (collectionName: string) => mongoose.Schema = collectionName => {
    const schema = new mongoose.Schema(
        {
            accountId: {
                type: String,
                required: true,
                unique: true
            },
            pdfExport: {
                renderOnlyFirstCarrouselItem: {
                    type: Boolean,
                    default: false,
                }
            },
            sso: {
                azure: {
                    tenantId: {
                        type: String
                    }
                },
                saml: {
                    enabled: {
                        type: Boolean
                    },
                    tenantId: {
                        type: String
                    },
                    issuer: {
                        type: String
                    },
                    certificateName: {
                        type: String
                    },
                    entryPoint: {
                        type: String
                    },
                    logout: {
                        type: String
                    },
                    // Alternative text to t(TK.Login_WithActiveDirectory)
                    ssoButtonText: {
                        type: String,
                        default: null
                    },
                    autoRedirect: {
                        type: Boolean,
                        default: false
                    },
                    enterpriseApplicationId: String,
                    // Below value is no longer used for group read, but for secrets in general (scenarios: MT-5105, MT-5150, ...?)
                    enterpriseApplicationGroupReadSecret: String,
                    userGroupIdForUserManagement: String,
                    provider: String,
                }
            },
            userTokenSecret: {
                type: String,
                required: false,
            },
            languages: {
                defaultCode: {
                    type: String
                },
                interfaceLanguage: {
                    type: String,
                },
            },
            visuals: {
                fitBehaviour: {
                    type: String
                },
                bgColor: {
                    type: String,
                    required: false,
                    default: "#FFFFFF",
                },
                audioEnabled: {
                    type: Boolean,
                    default: false,
                    required: false,
                },
            },
            mt: {
                generalOrder: {
                    type: Array,
                    default: defaultAccountSettings().mt.generalOrder,
                },
                pairs: {
                    type: mongoose.Schema.Types.Mixed,
                    default: {},
                }
            },
            sorting: {
                sortMethod: {
                    type: String,
                    default: "none"
                }
            },
            security: {
                autoLogout: Boolean,
                autoLogoutPeriodMinutes: Number
            },
            htmlHeadContent: {
                type: String,
            },
            ag5: {
                apiKey: {
                    type: String,
                    required: false,
                    trim: true,
                }
            },
            created: {
                type: Date,
                default: Date.now
            },
            updated: {
                type: Date,
                default: Date.now
            }
        }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
};

const daoToModel = (dao: IAccountSettingsMongoose | IAccountSettings): AccountSettings => {
    return new AccountSettings({
        languages: dao.languages,
        visuals: dao.visuals,
        mt: dao.mt,
        sorting: dao.sorting,
        pdfExport: dao.pdfExport,
        sso: dao.sso,
        userTokenSecret: dao.userTokenSecret,
        security: dao.security,
        htmlHeadContent: dao.htmlHeadContent,
        ag5: dao.ag5,
    });
}

export class MongoAccountSettingsRepository
    extends MongoRepository<IAccountSettingsMongoose>
    implements AccountSettingsRepository {

    async getAccountSettings(accountId: string): Promise<AccountSettings> {
        const settingsOption = await this.fetchOne({ accountId });
        const settings = settingsOption.caseOf({
            nothing: () => defaultAccountSettings(),
            just: (storedSettings) => storedSettings,
        });
        return daoToModel(settings);
    }

    async multiGetAccountSettings(accountIds: string[]): Promise<{ [accountId: string]: AccountSettings }> {
        const query = {
            accountId: mongoose.trusted({
                $in: accountIds.map(String)
            })
        };
        const values = await this.findEntities(query);
        return accountIds.reduce<{ [accountId: string]: AccountSettings }>((reduced, accountId) => {
            const accountSettings = values.find(storeSettings => storeSettings.accountId === accountId);
            const data = accountSettings || defaultAccountSettings();
            reduced[accountId] = new AccountSettings(data);
            return reduced;
        }, {});
    }

    async saveAccountSettings(accountId: string, settings: IAccountSettings): Promise<void> {
        const mongooseSettings = <IAccountSettings & { accountId: string }>{ ...settings, accountId };
        await this.saveEntity({ accountId }, mongooseSettings as IAccountSettingsMongoose);
    }

    async findAccountIdForAzureTenant(tenantId: string): Promise<string> {
        const settingsOption = await this.fetchOne({ "sso.azure.tenantId": tenantId });
        return settingsOption.caseOf({
            nothing: () => undefined,
            just: (settings) => settings.accountId
        });
    }
    async findAccountIdsForADTenant(tenantId: string): Promise<string[]> {
        const settings = await this.findEntities({ "sso.saml.tenantId": tenantId });
        return settings.map(s => s.accountId);
    }

}

export class MongoAccountSettingsRepositoryFactory extends MongoRepositoryFactory<IAccountSettingsMongoose> {

    build(logger: Logger): MongoAccountSettingsRepository {
        return new MongoAccountSettingsRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getAccountSettingsSchema(this.collection.name);
        this.model = this.collection.connection.model<IAccountSettingsMongoose>("AccountSettingsDAO", schema);
    }
}
