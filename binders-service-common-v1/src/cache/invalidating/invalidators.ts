import { AnyInvalidateEvent, InvalidateEventName, } from "./invalidateevents";
import { InvalidateEventType, Invalidator } from "./invalidator";
import { RedisClient, RedisClientBuilder } from "../../redis/client";
import {
    AclResourcesAccountInvalidator
} from  "../../persistentcache/stores/aclresources/invalidators/account";
import {
    AclResourcesAclInvalidator
} from  "../../persistentcache/stores/aclresources/invalidators/acl";
import { AclsAclInvalidator } from "../../persistentcache/stores/acls/invalidators/acl";
import {
    AncestorsCollectionInvalidator
} from  "../../persistentcache/stores/ancestors/invalidators/collection";
import {
    AncestorsDocumentInvalidator
} from  "../../persistentcache/stores/ancestors/invalidators/document";
import { BindersConfig } from "../../bindersconfig/binders";
import { GroupsGroupInvalidator } from "../../persistentcache/stores/groups/invalidators/group";
import { GroupsUserInvalidator } from "../../persistentcache/stores/groups/invalidators/user";


const _invalidators: {
    [name in InvalidateEventName]: {
        new(client: RedisClient): Invalidator<AnyInvalidateEvent>
    }[]
} = {
    usergroup: [
        GroupsGroupInvalidator
    ],
    collection: [
        AncestorsCollectionInvalidator
    ],
    document: [
        AncestorsDocumentInvalidator
    ],
    account: [
        AclResourcesAccountInvalidator
    ],
    acl: [
        AclResourcesAclInvalidator,
        AclsAclInvalidator
    ],
    user: [
        GroupsUserInvalidator
    ]
}

let _client: RedisClient | null = null;
const createGenericRedisClient = () => {
    if (_client != null) return _client;
    const config = BindersConfig.get();
    _client = RedisClientBuilder.fromConfig(config, "persistent-cache");
    return _client;
}

export const closeGenericRedisClient = async (): Promise<void> => {
    if (_client != null) {
        const client = _client;
        _client = null;
        await client.quit();
    }
}

export class InvalidatorManager {

    private readonly instances: {[key: string]: Invalidator<AnyInvalidateEvent>[]}
    private readonly client: RedisClient;

    constructor(
        client?: RedisClient
    ) {
        this.client = client ? client : createGenericRedisClient();
        this.instances = {};
    }

    onCreate(events: AnyInvalidateEvent[]): Promise<void> {
        return this.invalidate("onCreate", events);
    }

    onUpdate(events: AnyInvalidateEvent[]): Promise<void> {
        return this.invalidate("onUpdate", events);
    }

    onDelete(events: AnyInvalidateEvent[]): Promise<void> {
        return this.invalidate("onDelete", events);
    }

    private async invalidate(
        name: InvalidateEventType,
        events: AnyInvalidateEvent[]
    ): Promise<void> {
        const groupedEvents = this.groupEvents(events);
        for (const eventName in groupedEvents) {
            const instances = this.getInstancesFor(eventName);
            const promises = [];
            instances.forEach(instance => {
                if (name in instance) {
                    promises.push(
                        instance[name](groupedEvents[eventName])
                    );
                }
            });
            await Promise.all(promises);
        }
    }

    private groupEvents(events: AnyInvalidateEvent[]): Record<string, AnyInvalidateEvent[]> {
        const eventsMap = {};
        for (const event of events) {
            if (eventsMap[event.name] == null) {
                eventsMap[event.name] = [];
            }
            eventsMap[event.name].push(event);
        }
        return eventsMap;
    }

    private getInstancesFor(type: string): Invalidator<AnyInvalidateEvent>[] {
        if (_invalidators[type] == null) return [];
        if (this.instances[type] == null) {
            this.instances[type] = _invalidators[type].map(
                i => new i(this.client)
            );
        }
        return this.instances[type];
    }
}
