/**
 * LocalStorage polyfill
 * https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage
 */

(function() {
    this.supportsLocalStorage = function() {
        try {
            // When trying to access window.localStorage on some IE with Protected Mode enabled,
            // it throws an error, be sure to keep the `if` inside the `try`
            if (window.localStorage) {
                var test = "a";
                window.localStorage.setItem(test, test);
                window.localStorage.removeItem(test);
                return true;
            }
            return false;
        } catch (ex) {
            return false;
        }
    };

    var localStoragePolyfill = {
        _data: {},
        setItem: function(id, val) {
            return (this._data[id] = String(val));
        },
        getItem: function(id) {
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

    if (!this.supportsLocalStorage()) {
        try {
            window.localStorage = localStoragePolyfill;
        } catch (err) {
            // eslint-disable-next-line
            console.log("Could not inject localStorage polyfill.", err);
        }
    }
})();
