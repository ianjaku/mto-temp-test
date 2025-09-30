import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import {
    RedisSessionRepository
} from "@binders/binders-service-common/lib/authentication/sessionrepository";
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { info } from "@binders/client/lib/util/cli";
import { main } from "@binders/binders-service-common/lib/util/process";


const SCRIPT_NAME = "Delete redis session";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script will remove redis sessions for a user (for testing purposes)")
    .option("-u --user-id [userId]", "The user whose sessions should be removed")

function getOptions() {
    program.parse(process.argv);
    const { userId } = program.opts();
    if (!userId) {
        throw new Error("Either userId must be provided");
    }
    return {
        userId
    }
}

async function deleteAllSessionForUser(userId: string) {
    const config = BindersConfig.get();
    const repository = RedisSessionRepository.fromConfig(config);
    const sessions = await repository.getSessions(new UserIdentifier(userId));
    if (sessions.length === 0) {
        info(`No sessions found for user ${userId}`);
    }
    for (const session of sessions) {
        info(`Ending session ${session.sessionId}`);
        await repository.endSessionByIds(userId, session.sessionId);
    }
}

main(async () => {
    const options = getOptions();
    const { userId } = options;
    await deleteAllSessionForUser(userId);
});