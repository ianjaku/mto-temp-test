import { ITTSVoiceOptions } from "@binders/client/lib/clients/repositoryservice/v3/contract";

export class VoiceNotFound extends Error {

    static readonly NAME = "VoiceNotFound";

    constructor(options: ITTSVoiceOptions) {
        super(`No voice found matching the options: ${JSON.stringify(options)}`)
        this.name = VoiceNotFound.NAME;
    }
}
