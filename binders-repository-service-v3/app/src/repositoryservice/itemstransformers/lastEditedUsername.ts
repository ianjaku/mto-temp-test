import { Binder, Item } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ItemsTransformer } from "@binders/binders-service-common/lib/itemstransformers";
import { UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract";

class LastEditedUsernameTransformer implements ItemsTransformer {

    constructor(
        private userServiceContract: UserServiceContract,
    ) {}

    async items(items: Item[]): Promise<Item[]> {
        items = items.filter(i => !!i);
        const binders = items.filter(item => !item["elements"] && !item["binderId"]) as Binder[];
        const userNames = {};
        binders.forEach(binder => {
            if (binder.lastModifiedBy) {
                userNames[binder.lastModifiedBy] = undefined;
            }
            binder.modules.meta.forEach(({ lastModifiedBy }) => {
                if (lastModifiedBy) {
                    userNames[lastModifiedBy] = undefined;
                }
            });
        });
        const userIds = Object.keys(userNames);
        const userDetails = await this.userServiceContract.findUserDetailsForIds(userIds);
        for (const userId of Object.keys(userNames)) {
            const user = userDetails.find(u => u.id === userId);
            if (user) {
                const { displayName, login } = user;
                userNames[userId] = displayName || login;
            }
        }
        return items.reduce((reduced: Item[], item: Item) => {
            if (item.id && binders.some(b => b.id === item.id)) {
                const binder = item as Binder;
                return reduced.concat({
                    ...binder,
                    ...(binder.lastModifiedBy ? { lastModifiedByName: userNames[binder.lastModifiedBy]} : {}),
                    modules: {
                        ...binder.modules,
                        meta: binder.modules.meta.map(meta => ({
                            ...meta,
                            ...(meta.lastModifiedBy ? { lastModifiedByName: userNames[meta.lastModifiedBy] } : {}),
                        })),
                    }
                });
            }
            return reduced.concat(item);
        }, [] as Item[]);
    }
}

export default LastEditedUsernameTransformer;