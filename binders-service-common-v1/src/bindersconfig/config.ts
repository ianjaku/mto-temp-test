import * as fs from "fs";
import * as md5 from "md5";
import { ObjectConfig } from "@binders/client/lib/config/config";

export class JSONConfig extends ObjectConfig {

    reloadScheduled: boolean;
    fileContentMd5: string;

    // eslint-disable-next-line @typescript-eslint/ban-types
    constructor(data: Object, private filePath: string,
        protected reloadIntervalInSeconds?: number, md5Hash?: string) {
        super(data);
        this.scheduleReload();
        this.fileContentMd5 = md5Hash;
    }

    updateReloadInterval(intervalInSeconds: number): void {
        this.reloadIntervalInSeconds = intervalInSeconds;
        if (!this.reloadScheduled) {
            this.scheduleReload();
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    protected logInfo(message): void {
        // eslint-disable-next-line no-console
        console.log(message);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    protected logError(message) {
        // eslint-disable-next-line no-console
        console.error(message);
    }

    protected scheduleReload(): void {
        if (this.reloadIntervalInSeconds) {
            const scheduledReload = this.scheduledReload.bind(this);
            setTimeout(() => scheduledReload(), this.reloadIntervalInSeconds * 1000);
            this.reloadScheduled = true;
        }
        else {
            this.reloadScheduled = false;
        }
    }

    protected scheduledReload(): void {
        try {
            this.reload();
        }
        catch (e) {
            this.logError("Could not reload config file.");
            this.logError(e);
        }

        this.scheduleReload();
    }

    static create(filePath: string, reloadIntervalInSeconds?: number): JSONConfig {
        const {contents, md5Hash} = JSONConfig.getJsonFromFile(filePath);
        return new JSONConfig(contents, filePath, reloadIntervalInSeconds, md5Hash);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    protected static getJsonFromFile(filePath: string) {
        const fileContents = fs.readFileSync(filePath, "utf-8");
        const md5Hash = md5(fileContents);
        return {
            contents: JSON.parse(fileContents),
            md5Hash
        };
    }

    reload(): void {
        const { contents, md5Hash } = JSONConfig.getJsonFromFile(this.filePath);
        if (md5Hash !== this.fileContentMd5) {
            this.logInfo(`Reloading config from file ${this.filePath}`);
            this.data = contents;
            this.fileContentMd5 = md5Hash;
        }
    }
}

