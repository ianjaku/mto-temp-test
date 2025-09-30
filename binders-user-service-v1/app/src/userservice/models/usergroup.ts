import * as clientContract from "@binders/client/lib/clients/userservice/v1/contract";
import { Either } from "@binders/client/lib/monad";
import { EntityIdentifier } from "@binders/binders-service-common/lib/model/entities";
import { InvalidArgument } from "@binders/client/lib/util/errors";
import { USER_GROUP_IDENTIFIER_PREFIX } from "@binders/client/lib/clients/userservice/v1/constants";
import UUID from "@binders/client/lib/util/uuid";
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";

export class UsergroupIdentifier extends EntityIdentifier<string> {

    protected assert(id: string): void {
        if (!id || !id.startsWith(USER_GROUP_IDENTIFIER_PREFIX)) {
            throw new InvalidArgument(`Invalid usergroup id '${id}'`);
        }
    }

    static isUsergroupId(candidate: string): boolean {
        return candidate.startsWith(USER_GROUP_IDENTIFIER_PREFIX);
    }

    static generate(): UsergroupIdentifier {
        const id = UUID.randomWithPrefix(USER_GROUP_IDENTIFIER_PREFIX + "-");
        return new UsergroupIdentifier(id);
    }

    static build(key: string): Either<Error, UsergroupIdentifier> {
        try {
            return Either.right<Error, UsergroupIdentifier>(new UsergroupIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}


export class Usergroup {
    constructor(
        readonly id: UsergroupIdentifier,
        readonly name: string,
        readonly isReadonly: boolean = false,
        readonly isAutoManaged: boolean = false,
        readonly accountId?: string,
        readonly ownerUserIds?: string[],
    ) {

    }

    static create(name: string, isReadonly = false, isAutoManaged = false): Usergroup {
        const id = UsergroupIdentifier.generate();
        return new Usergroup(id, name, isReadonly, isAutoManaged);
    }

    updateName(newName: string): Usergroup {
        return new Usergroup(this.id, newName);
    }
}

export class UsergroupDetails {
    constructor(readonly group: Usergroup, readonly memberCount: number, readonly members: UserIdentifier[]) {
    }
}

export class UsergroupSearchResult {
    constructor(readonly hitCount: number, readonly hits: Usergroup[]) { }
}

export function usergroupModelToClient(usergroup: Usergroup): clientContract.Usergroup {
    return {
        id: usergroup.id.value(),
        name: usergroup.name,
        isReadonly: usergroup.isReadonly,
        isAutoManaged: usergroup.isAutoManaged,
        accountId: usergroup.accountId,
        ownerUserIds: usergroup.ownerUserIds,
    };
}
