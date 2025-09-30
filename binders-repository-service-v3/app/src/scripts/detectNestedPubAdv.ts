/* eslint-disable no-console */
import {
    AssigneeType,
    ResourceType
} from  "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { intersection, without } from "ramda";
import {
    BackendAuthorizationServiceClient
} from  "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const config = BindersConfig.get();

(async () => {

    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, "detect-nested-pub-adv");
    const authorizationClient = await BackendAuthorizationServiceClient.fromConfig(config, "detect-nested-pub-adv");
    const accountClient = await BackendAccountServiceClient.fromConfig(config, "detect-nested-pub-adv");
    const advItems = await repoServiceClient.findItems({ showInOverview: true }, { maxResults: 9999 });

    const itemIdsPerAccount = advItems.reduce((acc, item) => {
        if (!acc[item.accountId]) {
            acc[item.accountId] = [];
        }
        acc[item.accountId].push(item.id);
        return acc;
    }, {});

    const accounts = await accountClient.listAccounts();

    for (const accountId of Object.keys(itemIdsPerAccount)) {

        const acls = await authorizationClient.resourceAcls({
            type: ResourceType.DOCUMENT,
            ids: itemIdsPerAccount[accountId],
        }, accountId);

        const pubAdvItems = advItems.filter(i => {

            const isPublic = (acls[i.id] || []).some(acl =>
                acl.assignees.some(a => a.type === AssigneeType.PUBLIC) &&
                acl.rules.some(r => r.resource.ids.includes(i.id))
            );

            return isPublic;
        });

        const nestedPubAdvItemIds = [];


        for (const item of pubAdvItems) {
            const documentAncestors = await repoServiceClient.getAncestors(item.id);
            if (documentAncestors[item.id]) {
                const ancestorIds = without([item.id], Object.keys(documentAncestors));
                if (intersection(ancestorIds, pubAdvItems.map(i => i.id)).length > 0) {
                    nestedPubAdvItemIds.push(item.id);
                }
            }
        }

        if (nestedPubAdvItemIds.length > 0) {
            console.log(`==${accounts.find(a => a.id === accountId)?.name} (${accountId})==\n\n${nestedPubAdvItemIds.join("\n")}\n\n`)
        }

    }

    console.log("Done");
})();