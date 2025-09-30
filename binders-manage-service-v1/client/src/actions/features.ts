import {
    linkFeature as remoteLinkFeature,
    linkManyFeatures as remoteLinkManyFeatures,
    unlinkFeature as remoteUnlinkFeature
} from  "../api/features";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { Action } from "../action";
import { IFeatureUsage } from "@binders/client/lib/clients/accountservice/v1/contract";
import config from "../config";
import dispatcher from "../dispatcher";
import { getBackendRequestHandler } from "../api/handler";
import { toast } from "../components/use-toast";
import { toastStyles } from "../components/toast";

const client = AccountServiceClient.fromConfig(config, "v1", getBackendRequestHandler());


export abstract class FeaturesAction implements Action { }


export class FeaturesReceived extends FeaturesAction {
    constructor(public features: string[]) {
        super();
    }
}

export class FeaturesUsageReceived extends FeaturesAction {
    constructor(public featuresUsage: IFeatureUsage) {
        super();
    }
}

function handleError(error) {
    // eslint-disable-next-line no-console
    console.error(error);
    toast({ className: toastStyles.error, title: "Server error", description: error.message })
}

export class FeaturesActions {

    static loadFeatures(accountId?: string): void {
        client.getAccountFeatures(accountId)
            .then(features => {
                FeaturesActions.featuresReceived(features);
            })
            .catch(handleError);

        client.getAccountFeaturesUsage()
            .then(featuresUsage => {
                FeaturesActions.featuresUsageReceived(featuresUsage);
            })
            .catch(handleError)
    }

    static featuresReceived(features: string[]): void {
        dispatcher.dispatch(new FeaturesReceived(features));
    }

    static featuresUsageReceived(featuresUsage: IFeatureUsage): void {
        dispatcher.dispatch(new FeaturesUsageReceived(featuresUsage));
    }

    static async linkManyFeatures(accountId: string, features: string[]): Promise<void> {
        await remoteLinkManyFeatures(accountId, features);
        FeaturesActions.loadFeatures(accountId);
    }

    static async linkFeature(accountId: string, feature: string): Promise<void> {
        await remoteLinkFeature(accountId, feature);
        FeaturesActions.loadFeatures(accountId);
    }

    static async unlinkFeature(accountId: string, feature: string): Promise<void> {
        await remoteUnlinkFeature(accountId, feature)
        FeaturesActions.loadFeatures(accountId);
    }
}

export default FeaturesActions;
