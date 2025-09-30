import * as fs from "fs";
import * as path from "path";
import {
    AudioConfig,
    SpeechConfig,
    SpeechSynthesisOutputFormat,
    SpeechSynthesizer
} from "microsoft-cognitiveservices-speech-sdk";
import { Config, ConfigError } from "@binders/client/lib/config/config";
import { HTTPVerb } from "@binders/client/lib/clients/routes";
import { IPartialBoundary } from "@binders/client/lib/highlight/highlight";
import { ITTSVoiceOptions } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TTSTimeout } from "./errors/tts_timeout";
import { VoiceNotFound } from "./errors/voice_not_found";
import fetch from "node-fetch";
import { parseBodyInFetchResponse } from "../apiclient/helpers";
import sleep from "../util/sleep";

interface IAzureVoice {
    Name: string;
    DisplayName: string;
    LocalName: string;
    ShortName: string;
    Gender: string;
    Locale: string;
    LocaleName: string;
    SampleRateHertz: string;
    VoiceType: string;
    Status: string;
}

export interface IVoice {
    name: string;
    gender: string;
    language: string;
}

export interface ITTSOptions {
    voice: ITTSVoiceOptions;
}

let cachedVoices: IVoice[] | null = null;
let voicesCachedAt = 0;

export class TextToSpeech {

    constructor(
        private subscriptionKey: string,
        private serviceRegion: string,
        private storagePath: string
    ) {
        this.ensureStoragePathExists();
    }

    async generateToFile(
        paragraphs: string[],
        fileName: string,
        options: ITTSOptions
    ): Promise<IPartialBoundary[]> {
        const fullPath = path.join(this.storagePath, fileName);
        const audioConfig = AudioConfig.fromAudioFileOutput(fullPath);
        const speechConfig = SpeechConfig.fromSubscription(
            this.subscriptionKey,
            this.serviceRegion
        );
        speechConfig.speechSynthesisOutputFormat = SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
        const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);
        const voice = await this.pickVoice(options.voice);
        const boundaries: IPartialBoundary[] = [];
        synthesizer.wordBoundary = (synth, event) => {
            boundaries.push({
                text: event.text,
                offsetMS: event.audioOffset / 10000
            });
        }

        return await new Promise<IPartialBoundary[]>((resolve, reject) => {
            synthesizer.speakSsmlAsync(
                this.generateSSMLFromParagraphs(paragraphs, voice),
                async (result) => {
                    await this.waitForFileToHaveSize(fullPath, result.audioData.byteLength, 10, 50);
                    resolve(boundaries);
                },
                (err) => reject(err)
            );
        }).finally(() => {
            synthesizer.close()
        });
    }

    async fetchAvailableVoices(): Promise<IVoice[]> {
        if (cachedVoices != null && voicesCachedAt + 86400 > (new Date()).getTime()) {
            return cachedVoices;
        }
        const response = await fetch(
            `https://${this.serviceRegion}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
            {
                method: HTTPVerb.GET,
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey
                }
            }
        );
        const azureVoices = await parseBodyInFetchResponse<IAzureVoice[]>(response);

        const voices = azureVoices.map(voice => ({
            name: voice.ShortName,
            gender: voice.Gender,
            language: voice.Locale
        }));
        cachedVoices = voices;
        voicesCachedAt = (new Date()).getTime();
        return voices;
    }

    private async pickVoice(
        voiceOptions: ITTSVoiceOptions
    ): Promise<IVoice> {
        const availableVoices = await this.fetchAvailableVoices();

        if (voiceOptions.name != null) {
            const voice = availableVoices.find(v => v.name === voiceOptions.name);
            if (voice == null) {
                throw new VoiceNotFound(voiceOptions);
            }
            return voice;
        }

        if (voiceOptions.gender == null && voiceOptions.language == null) {
            throw new VoiceNotFound(voiceOptions);
        }
        const language = voiceOptions.language === "en" ? "en-US" : voiceOptions.language;

        const filteredVoices = availableVoices
            .filter(voice => (
                (
                    voiceOptions.gender == null ||
                    voiceOptions.gender.toLowerCase() === voice.gender.toLowerCase()
                ) &&
                (
                    language == null ||
                    voice.language.toLowerCase().startsWith(language.toLowerCase())
                )
            ));

        if (filteredVoices.length === 0) {
            throw new VoiceNotFound(voiceOptions);
        }

        return filteredVoices[0];
    }

    public getStoragePath(): string {
        return this.storagePath;
    }

    private ensureStoragePathExists() {
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath)
        }
    }

    private generateSSMLFromParagraphs(
        paragraphs: string[],
        voice: IVoice
    ): string {
        const text = paragraphs.map(p => `<p>${p}</p>\n`).join("").slice(0, -1);
        
        return `
<speak
    version="1.0"
    xmlns="http://www.w3.org/2001/10/synthesis"
    xml:lang="${voice.language}"
>
    <voice name="${voice.name}">
        ${text}
    </voice>
</speak>
        `;
    }

    private async waitForFileToHaveSize(
        path: string,
        byteLength: number,
        maxRetries: number,
        pauseTimeMS: number
    ) {
        for (let i = 0; i < maxRetries; i ++) {
            const stats = fs.statSync(path)
            if (stats.size === byteLength) {
                return;
            }
            await sleep(pauseTimeMS);
        }
        throw new TTSTimeout();
    }

    public static fromConfig(config: Config): TextToSpeech {
        const ttsConfig = config.getObject("azure.cognitiveServices");
        if (ttsConfig.isNothing()) {
            throw new ConfigError("Missing config settings for text to speech.");
        }
        const settings = <{speechServiceAccessKey: string}>ttsConfig.get();

        return new TextToSpeech(
            settings.speechServiceAccessKey,
            "westeurope",
            "/tmp/tts"
        );
    }
}
