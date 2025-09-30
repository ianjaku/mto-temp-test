import { FlashMessages } from "../logging/FlashMessages";
import { fluxWrap } from "@binders/client/lib/webdata/flux";

export async function wrapAction(apiCall, messagePrefix, errorFlashMessage) {
    try {
        return await fluxWrap(apiCall, messagePrefix);
    } catch (error) {
        /* eslint-disable no-console */
        // @TODO report this back to the server
        console.error(error);
        /* eslint-enable no-console */

        if (errorFlashMessage !== undefined) {
            const msg = (typeof errorFlashMessage === "function") ?
                errorFlashMessage(error) :
                errorFlashMessage;
            FlashMessages.error(msg);
        }

    }
}