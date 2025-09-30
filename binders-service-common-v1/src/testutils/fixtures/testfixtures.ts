import * as path from "path";
import { Config } from "@binders/client/lib/config/config";
import { TestAccountFactory } from "./accountfactory";
import { TestAccountFixtures } from "./testaccountfixtures";
import { closeGenericRedisClient } from "../../cache/invalidating/invalidators";
import { deleteTestAccounts } from "../cleanup";
import { minutesToMilliseconds } from "date-fns";

const JEST_TIMEOUT_MS = minutesToMilliseconds(4);

export class TestFixtures {

    private readonly accountFactory: TestAccountFactory;
    private readonly serviceName: string;
    private readonly testFileName: string;

    constructor(
        private readonly config: Config,
    ) {
        beforeAll(async () => {
            if (typeof jest !== "undefined") {
                jest.setTimeout(JEST_TIMEOUT_MS);
            }
            try {
                await this.delete();
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error("There was an error while cleaning test accounts in beforeAll");
                // eslint-disable-next-line no-console
                console.error(e);
            }
        })
        afterAll(async () => {
            await closeGenericRedisClient();
        });
        if (typeof jest !== "undefined") {
            jest.setTimeout(JEST_TIMEOUT_MS);
        }

        const filePath = this.getCallerFilePath()
        this.serviceName = this.extractServiceName(filePath);
        this.testFileName = this.extractFileName(filePath);
        this.accountFactory = new TestAccountFactory(config);
    }

    private getCallerFilePath() {
        const filePath = this.getStackTrace()
            .map(cs => cs.getFileName())
            .filter(fn => fn !== __filename)
            .shift();
        if (!filePath) {
            throw new Error("Could not determine caller file path");
        }
        return filePath;
    }

    private getStackTrace(): NodeJS.CallSite[] {
        const previousPrepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = (_err, stackTrace) => stackTrace;
        try {
            throw new Error("");
        } catch (error) {
            return (error.stack as NodeJS.CallSite[]);
        } finally {
            Error.prepareStackTrace = previousPrepareStackTrace;
        }
    }

    private extractServiceName(filePath: string): string {
        const pathParts = filePath.split(path.sep);
        for (const part of pathParts) {
            const match = part.match(/^binders-(.*?-v\d)$/);
            if (match) {
                return match[1];
            }
        }
        throw new Error(`Could not correctly parse service name from ${filePath}`);
    }

    private extractFileName(filePath: string): string {
        const parentDir = path.basename(path.dirname(filePath));
        const fileName = path.basename(filePath);
        if (parentDir !== "integration") {
            return path.join(parentDir, fileName);
        }
        return fileName;
    }

    /**
     * Takes any account previously used in the same test file.
     * Will create a new account, if none has been created.
     */
    public async withAnyAccount(
        callback: (
            accountFixtures: TestAccountFixtures,
            accountId: string
        ) => Promise<unknown>
    ): Promise<void> {
        const accountId = await this.accountFactory.getAnyAccount();
        await callback(
            new TestAccountFixtures(
                this.config,
                accountId
            ),
            accountId
        );
    }

    public async withFreshAccount(
        callback: (
            accountFixtures: TestAccountFixtures,
            accountId: string
        ) => Promise<unknown>
    ): Promise<void> {
        const account = await this.accountFactory.getPrefixedFreshAccount(this.getFullName());
        await callback(
            new TestAccountFixtures(
                this.config,
                account.id
            ),
            account.id
        );
    }

    private async delete(): Promise<void> {
        await deleteTestAccounts(this.getFullName());
    }

    private getFullName() {
        return this.serviceName + "__" + this.testFileName;
    }
}
