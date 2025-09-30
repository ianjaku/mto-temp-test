// https://github.com/Financial-Times/polyfill-service/blob/master/packages/polyfill-library/polyfills/navigator/sendBeacon/polyfill.js

if (!("sendBeacon" in window.navigator)) {
    window.navigator.sendBeacon = function sendBeacon(url, data) {
        // eslint-disable-next-line
        var xhr = ("XMLHttpRequest" in window) ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
        xhr.open("POST", url, false);
        xhr.setRequestHeader("Accept", "*/*");
        if (typeof data === "string") {
            xhr.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
        } else if (Object.prototype.toString.call(data) === "[object Blob]") {
            if (data.type) {
                xhr.setRequestHeader("Content-Type", data.type);
            }
        }
        xhr.send(data);
        return true;
    };
}