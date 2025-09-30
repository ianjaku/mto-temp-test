import { FEATURE_DEBUG_LOGGING } from "../clients/accountservice/v1/contract";

const ACL_LOADING_TICKET = "MT-2312";

function getTextDecoration(category: string) {
    switch(category) {
        case ACL_LOADING_TICKET: {
            return {
                prefix: "🛠️ [acls]: ",
                css: "color: #173F5F; padding: 10px; background: #66dd66"
            }
        }
        default: {
            const prefix = category ?
                `🛠️ [${category}]: ` :
                "🛠️ "

            return {
                prefix,
                css: "color: #173F5F; padding: 10px; background: #f6D55C"
            }
        }
    }
}

function getDecoratedText(message: string, category: string) {
    const { prefix, css } = getTextDecoration(category);
    return [`%c${prefix}${message}`, css]
}

export default class DebugLog {
    private static isDebugModeEnabled = false;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static setDebugFeature(features): void {
        try{
            this.isDebugModeEnabled = features.includes(FEATURE_DEBUG_LOGGING);
        } catch (ex) {
            // eslint-disable-next-line no-console
            console.warn("Problem with debug logging", ex);
        }
    }

    public static log(message: string, category: string): void {
        const decoratedMessage = getDecoratedText(message, category);
        if (this.isDebugModeEnabled) {
            // eslint-disable-next-line no-console
            console.log(...decoratedMessage);
        }
    }
}