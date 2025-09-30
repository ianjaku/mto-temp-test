import Binder from "@binders/client/lib/binders/custom/class";
import { FlashMessages } from "../../../logging/FlashMessages";
import { IVisualPosition } from "../contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import {
    LaunchDarklyFlagsStoreGetters
} from "@binders/ui-kit/lib/thirdparty/launchdarkly/ld-flags-store";
import { UpdatePatch } from "tcomb";
import { getInjectChunkPatches } from "@binders/client/lib/binders/editing";
import {
    handleVisualUploadError
} from "@binders/client/lib/clients/imageservice/v1/errorHandlers";
import { uploadVisualFiles } from "../../../media/actions";


export async function onUploadVisualFiles(
    binder: Binder,
    visualFiles: File[],
    positions: IVisualPosition[],
    chunkCount: number,
    accountId: string,
    toNewChunk?: boolean,
): Promise<UpdatePatch[]> {
    try {
        const shouldUseNewTextEditor = LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.USE_TIP_TAP];
        const patches: UpdatePatch[] = toNewChunk ? getInjectChunkPatches(binder, chunkCount, undefined, shouldUseNewTextEditor) : [];
        const uploadPatches = await uploadVisualFiles(
            binder,
            visualFiles,
            binder.getImagesModuleKey(),
            positions,
            accountId,
        );
        return [...patches, ...uploadPatches];
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error("err during upload", e);
        handleVisualUploadError(
            e,
            msg => FlashMessages.error(msg, true),
            visualFiles.length > 1
        );
    }
}