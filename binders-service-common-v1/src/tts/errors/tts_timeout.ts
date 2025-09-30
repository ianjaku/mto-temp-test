export class TTSTimeout extends Error {

    static readonly NAME = "TTSTimeout";

    constructor() {
        super(
            "Waited for the Text to speech to finish but nothing happened."
        );
        this.name = TTSTimeout.NAME;
    }
}
