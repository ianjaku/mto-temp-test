import BinderClass, { update } from "@binders/client/lib/binders/custom/class";
import {
    mergePatches,
    patchAllTextMetaTimestamps,
    patchUpdateBinderLog
} from  "@binders/client/lib/binders/patching";
import { BackendRepoServiceClient } from "../../apiclient/backendclient";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { Config } from "@binders/client/lib/config/config";


export class TestChecklistFactory {

    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) {}

    /**
     * The same action that happens when toggling the "checkable" switch in a document.
     * + publishing after (if shouldPublish is set to true)
     * 
     * @returns the chunkId of the chunk on which a checklist was enabled
     */
    async enableChecklistInDocument(
        doc: Binder,
        chunkIndex: number,
        shouldPublish = true
    ): Promise<string> {
        const client = await this.repoClient();
        const chunkId = this.chunkIdFromIndex(doc, chunkIndex);
        await client.saveChecklistActivation(doc.id, chunkId, true);
        const binderInstance = new BinderClass(doc);
        const patch = mergePatches([
            patchUpdateBinderLog(binderInstance, 0),
            patchAllTextMetaTimestamps(binderInstance)
        ]);

        const updatedBinderInstance = update(binderInstance, () => [patch], true);
        const newDoc: Binder = updatedBinderInstance.toJSON();

        await client.updateBinder(newDoc);

        if (shouldPublish) {
            await client.publish(
                newDoc.id,
                newDoc.languages.map(l => l.iso639_1) // all language codes
            );
        }

        return chunkId;
    }

    async getChecklistId(binder: Binder, chunkIndex: number): Promise<string> {
        const client = await this.repoClient();
        const checklists = await client.getChecklists(binder.id);
        const chunkId = this.chunkIdFromIndex(binder, chunkIndex);
        const checklist = checklists.find(c => c.chunkId === chunkId);
        if (checklist == null) {
            throw new Error(`There is no checklist at chunkIndex ${chunkIndex} of binder ${binder.id}`);
        }
        return checklist.id;
    }

    private chunkIdFromIndex(doc: Binder, chunkIndex = 0): string {
        if (doc.binderLog?.current == null) {
            throw new Error("No binder log available");
        }
        const binderLog = doc.binderLog.current.find(log => log.position === chunkIndex);
        if (binderLog == null) {
            throw new Error(`No chunk at index ${chunkIndex}`);
        }
        return binderLog.uuid;
    }

    private repoClient() {
        return BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
    }
    
}
