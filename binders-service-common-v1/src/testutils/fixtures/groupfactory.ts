import { BackendUserServiceClient } from "../../apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";

let uniqueCounter = 0;

export class TestGroupFactory {

    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) {}

    async create(name: string = ("testgroup-" + uniqueCounter ++)): Promise<Usergroup> {
        const client = await this.userClient();
        return await client.createGroup(this.accountId, name)
    }

    async addUserToGroup(groupId: string, userId: string): Promise<void> {
        const client = await this.userClient();
        await client.addGroupMember(this.accountId, groupId, userId);
    }

    private userClient() {
        return BackendUserServiceClient.fromConfig(
            this.config,
            "testing"
        );
    }
    
}
