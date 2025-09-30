import * as agent from "superagent";
import { FEATURE_READONLY_EDITOR } from "@binders/client/lib/clients/accountservice/v1/contract";
import vars from "@binders/ui-kit/lib/variables";

export const doPost = (uri, body = {}) => {
    let request = agent.post(uri);
    request = request.set("Accept", "application/json");
    request = request.set("Content-Type", "application/json");
    request = request.send(JSON.stringify(body));
    return new Promise((resolve, reject) => {
        request.end((error, result) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}

export const enableGodMode = () => {
    window.bindersConfig.godMode = true;
}

export const isGodModeEnabled = () => (!!window.bindersConfig.godMode);

export const isMobileViewOnOpenRightPane = () => {
    return window.innerWidth < vars.mobileOnRightpaneOpen.replace("px", "");
}

// for readonly editor, translator role etc
export const isThisItemHidden = (accountFeatures, anythingEditableForMeForThisAccount, canEdit = false, canView = false) => {
    if(accountFeatures && accountFeatures.includes(FEATURE_READONLY_EDITOR)) {
        if(!anythingEditableForMeForThisAccount) {
            return true;
        }
        if(canEdit) {
            return false;
        }
        if(canView) {
            return true;
        }
    }

    return false;
}

export function putInClipboard(text) {
    return navigator.clipboard.writeText(text);
}

export function arraysEqual(arr1, arr2) {
    return (arr1 || []).join() === (arr2 || []).join();
}

