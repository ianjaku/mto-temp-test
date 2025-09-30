import { VisualIdentifier, visualFormatTypeToString } from "./model";
import { VisualFormatType } from "@binders/client/lib/clients/imageservice/v1/contract";

export interface URLBuilder {
    getVisualURL(binderId: string, imageId: VisualIdentifier, imageFormat: VisualFormatType): string;
}

export class SimplePrefixURlBuilder implements URLBuilder {

    constructor(private prefix: string) {
    }

    getVisualURL(binderId: string, visualId: VisualIdentifier, imageFormat: VisualFormatType): string {
        return [
            this.prefix,
            "binders",
            binderId,
            visualId.value(),
            visualFormatTypeToString(imageFormat).toLowerCase(),
        ].join("/");
    }
}