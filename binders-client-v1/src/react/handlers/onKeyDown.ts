import { safeLocalStorageGetItem, safeLocalStorageRemoveItem, safeLocalStorageSetItem } from "../../localstorage";

export const GOD_KEY = "god";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const onKeyDown = e => {
    if (e.ctrlKey && e.altKey && e.code === "KeyG") {
        if (isGodModeEnabled()) {
            // eslint-disable-next-line
            console.log("disabling god mode");
            safeLocalStorageRemoveItem(GOD_KEY);
            window.location.reload();
        } else {
            // eslint-disable-next-line
            console.log("enabling god mode");
            safeLocalStorageSetItem(GOD_KEY, "set");
            window.location.reload();
        }
    }
};

export const isGodModeEnabled = (): boolean => {
    return !!safeLocalStorageGetItem(GOD_KEY);
}

export default onKeyDown;
