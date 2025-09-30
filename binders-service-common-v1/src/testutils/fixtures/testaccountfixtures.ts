import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BackendAccountServiceClient } from "../../apiclient/backendclient";
import { BackendAuthorizationServiceClient } from "../../authorization/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { TestAccountFactory } from "./accountfactory";
import { TestAuthorizationFactory } from "./authorizationfactory";
import { TestChecklistFactory } from "./checklistfactory";
import { TestEditorCommentsFactory } from "./editorcommentsfactory";
import { TestFeedbacksFactory } from "./feedbacksfactory";
import { TestGroupFactory } from "./groupfactory";
import { TestImageFactory } from "./imagefactory";
import { TestItemFactory } from "./itemfactory";
import { TestNotificationTargetFactory } from "./notificationtargetfactory";
import { TestOwnershipFactory } from "./ownershipfactory";
import { TestReaderCommentsFactory } from "./readercommentsfactory";
import { TestRoutingFactory } from "./routingfactory";
import { TestUserFactory } from "./userfactory";

export class TestAccountFixtures {

    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) {}

    get accounts(): TestAccountFactory {
        return new TestAccountFactory(this.config);
    }

    get users(): TestUserFactory {
        return new TestUserFactory(this.config, this.accountId);
    }

    get groups(): TestGroupFactory {
        return new TestGroupFactory(this.config, this.accountId);
    }

    get items(): TestItemFactory {
        return new TestItemFactory(this.config, this.accountId);
    }

    get notificationTargets(): TestNotificationTargetFactory {
        return new TestNotificationTargetFactory(this.config, this.accountId);
    }

    get authorization(): TestAuthorizationFactory {
        return new TestAuthorizationFactory(this.config, this.accountId);
    }

    get routing(): TestRoutingFactory {
        return new TestRoutingFactory(this.config);
    }

    get checklists(): TestChecklistFactory {
        return new TestChecklistFactory(this.config, this.accountId);
    }

    get images(): TestImageFactory {
        return new TestImageFactory(this.config, this.accountId);
    }

    get editorComments(): TestEditorCommentsFactory {
        return new TestEditorCommentsFactory(this.config, this.accountId);
    }

    get readerComments(): TestReaderCommentsFactory {
        return new TestReaderCommentsFactory(this.config, this.accountId);
    }

    get feedbacks(): TestFeedbacksFactory {
        return new TestFeedbacksFactory(this.config, this.accountId);
    }

    get ownership(): TestOwnershipFactory {
        return new TestOwnershipFactory(this.config, this.accountId);
    }

    public getAccountId(): string {
        return this.accountId;
    }

    public async getAccount(): Promise<Account> {
        const accountClient = await BackendAccountServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return await accountClient.getAccount(this.getAccountId());
    }

    public async getAdminGroupId(): Promise<string> {
        const authorizationServiceClient = await BackendAuthorizationServiceClient.fromConfig(
            this.config,
            "testing",
            { skipCache: true },
        );
        return authorizationServiceClient.getAdminGroup(this.getAccountId());
    }

    public getDomain(): string {
        return `test-${this.getAccountId()}.manual.to`;
    }

    async setFeatures(features: string[], enabled = true): Promise<void> {
        const accountClient = await BackendAccountServiceClient.fromConfig(
            this.config,
            "testing"
        );
        for (const feature of features) {
            if (enabled) {
                await accountClient.linkFeature(this.getAccountId(), feature);
            } else {
                await accountClient.unlinkFeature(this.getAccountId(), feature);
            }
        }
    }

    public async enableFeatures(features: string[]): Promise<void> {
        await this.setFeatures(features, true);
    }

    public async disableFeatures(features: string[]): Promise<void> {
        await this.setFeatures(features, false);
    }


}
