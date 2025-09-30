/*
* This module was created to work around an issue experienced by AWL
* They are running some Windows DVI with Internet Explorer with some weird settings,
* making localStorage completely toxic.
* Accessing `window.localStorage` throws an exception. It also cannot be overwritten by the polyfills we use.
* Make sure that we use these functions to interact with localStorage in all future cases
*/

const localStoragePolyfill = {
    _data: {},
    setItem: function(id, val) {
        return (this._data[id] = String(val));
    },
    getItem: function(id) {
        // eslint-disable-next-line no-prototype-builtins
        return this._data.hasOwnProperty(id) ? this._data[id] : undefined;
    },
    removeItem: function(id) {
        return delete this._data[id];
    },
    clear: function() {
        return (this._data = {});
    },
    key: function(keyId) {
        return this._data[keyId];
    },
    length: function() {
        return this._data.length;
    }
};

export const safeLocalStorageGetItem = (key: string) : string => {
    try {
        if (window.localStorage) {
            return window.localStorage.getItem(key);
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Error while accessing localStorage with key ${key}`);
    }
    return localStoragePolyfill.getItem(key);
}

export const safeLocalStorageSetItem = (key: string, value: string): void => {
    try {
        if (window.localStorage) {
            window.localStorage.setItem(key, value);
            return;
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error while writing to localStorage");
    }
    localStoragePolyfill.setItem(key, value);
}

export const safeLocalStorageRemoveItem = (key: string): void => {
    try {
        if (window.localStorage) {
            window.localStorage.removeItem(key);
            return;
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error while deleting item from localStorage");
    }
    localStoragePolyfill.removeItem(key);
}
