import AzureBlobStorage, { buildBLOBConfig } from "../storage/azure/AzureBlobStorage";
import {
    FontProperties,
    FontWeightType
} from  "@binders/client/lib/clients/routingservice/v1/contract";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { compose, head, split } from "ramda";
import { isProduction, isStaging } from "@binders/client/lib/util/environment";
import { Config } from "@binders/client/lib/config/config";
import { Response } from "express";

export interface FontStorage {
    uploadFontFile(localFile: string, name: string, weight: string, style: string): Promise<void>;
    uploadFontFaceFile(localFile: string, name: string): Promise<void>;
    sendFontFileWithExpress(fontName: string, weight: string, style: string, response: Response): Promise<void>;
    sendFontFaceFileWithExpress(fontName: string, response: Response): Promise<void>;
}

export class AzureFontStorage implements FontStorage {
    private globalLogger: Logger;
    private azureStorage: AzureBlobStorage;

    constructor(
        private readonly config: Config,
        private readonly logger: Logger,
    ) {
        this.globalLogger = LoggerBuilder.fromConfig(this.config, "font-storage");
        const azureConfig = buildBLOBConfig(this.config, "azure.fonts")
            .caseOf({
                left: () => {
                    return buildBLOBConfig(this.config, "azure.blobs.fonts")
                        .caseOf({
                            left: error => { throw error; },
                            right: cfg => cfg
                        });
                },
                right: cfg => cfg
            });
        this.azureStorage = new AzureBlobStorage(this.globalLogger, azureConfig);
    }

    /*
      storage locations
    */

    getImageServiceFontLocation(...names: string[]): string {
        return `${this.getFontsHost()}/images/v1/fonts/${names.join("/")}`;
    }

    private getFontsHost() {
        if (isProduction()) {
            return "https://api.binders.media";
        }
        if (isStaging()) {
            return "https://staging-api.dev.binders.media";
        }
        // docker dev env
        return "http://dockerhost:30007";
    }


    getFontFaceLocation(fontName: string): string {
        return `${fontName}/${fontName}.css`;
    }

    /*
      font properties
    */

    private getFontNameWithProps(font: string): string {
        const retrieveFontName = /([\w\d_-\s]*)\.?(?:\w*)$/;
        return retrieveFontName.exec(font)[1];
    }

    getFontName: (name: string) => (string) = compose<string[], string, string[], string>(head, split("-"), this.getFontNameWithProps);


    private findFontWeight(props: string): string {
        let weight = "regular";
        for (const w in FontWeightType) {
            if (props.indexOf(w) >= 0) {
                weight = w;
                break;
            }
        }
        return weight;
    }

    getFontProps(font: string): FontProperties {
        const fontNameWithProps = this.getFontNameWithProps(font);
        const [name, ...rest] = fontNameWithProps.split("-");
        const props = rest.join().toLowerCase();
        const [fullName] = fontNameWithProps.split(".");
        const style = props.indexOf("italic") >= 0 ? "italic" : "normal";
        const weight = this.findFontWeight(props);
        return {
            name, // font family name
            fullName, // full font name, without extension
            weight,
            style,
        };
    }

    isCustomFont(font: string): boolean {
        return font.indexOf("/") >= 0 || font.indexOf(".") >= 0 || font.indexOf("woff") >= 0;
    }

    /*
      font face generation
    */

    private generateFontFaceTemplate(
        name: string,
        fullName: string,
        style = "normal",
        weight: FontWeightType = FontWeightType.regular,
        url: string
    ): string {
        return `@font-face {
            font-family: '${name}';
            font-style: ${style};
            font-weight: ${weight};
            src: local('${fullName}'), url(${url}) format('woff');
          }`;
    }

    generateFontFaceFile(fonts: Array<string>): string {
        return fonts.reduce((acc, font) => {
            const { name, fullName, style, weight } = this.getFontProps(font);
            const url = this.getImageServiceFontLocation(name.toLowerCase(), weight, style);
            return acc + this.generateFontFaceTemplate(name, fullName, style, FontWeightType[weight], url);
        }, "");
    }

    /*
      uploading to azure, downloading from azure
    */

    async uploadFontFile(localFile: string, name: string, weight: string, style: string): Promise<void> {
        this.logger.info(`Storing new font: ${name}-${weight}-${style}`, "font-storage");
        await this.azureStorage.uploadFontFile(localFile, name.toLowerCase(), weight.toLowerCase(), style.toLowerCase());
        this.logger.info(`Successfully stored font: ${name}-${weight}-${style}`, "font-storage");
    }

    async uploadFontFaceFile(localFile: string, name: string): Promise<void> {
        this.logger.info(`Storing new fontface: ${name}`, "font-storage");
        await this.azureStorage.uploadFontFaceFile(localFile, name.toLowerCase());
        this.logger.info(`Successfully stored fontface: ${name}`, "font-storage");
    }

    async sendFontFaceFileWithExpress(name: string, response: Response): Promise<void> {
        this.logger.info(`Getting font face for font ${name}`, "font-storage");
        await this.azureStorage.sendFontFaceFileWithExpress(name, response);
        this.logger.info(`Successfully downloaded font-face for font ${name}`, "font-storage");
    }

    async sendFontFileWithExpress(name: string, weight: string, style: string, response: Response): Promise<void> {
        this.logger.info(`Getting font ${name}-${weight}-${style} from storage`, "font-storage");
        await this.azureStorage.sendFontFileWithExpress(name, weight, style, response);
        this.logger.info(`Successfully downloaded font ${name}-${weight}-${style} from storage`, "font-storage");
    }

}
