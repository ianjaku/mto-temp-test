// eslint-disable-next-line sort-imports
import * as React from "react";
import * as ReactDOM from "react-dom";
import onKeyDown, { isGodModeEnabled } from "@binders/client/lib/react/handlers/onKeyDown";
import App from "./routes/"
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import { maybeSetupPerformanceObservers } from "@binders/client/lib/performance/resourceTimings";
import onBrowserUnload from "./handlers/onBrowserUnload"
import { trackingClient } from "./api/trackingService";
import "./font-awesome.min.css";
import "./main.styl";
import "@binders/client/lib/react/i18n";

eventQueue.setAuthTokenProvider(() => trackingClient.createLogAuthToken())

ReactDOM.render(<App />, document.getElementById("reader-main"));

// Per https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        onBrowserUnload();
    }
});
// Fallback for "visibilitychange"
window.addEventListener("pagehide", onBrowserUnload);

document.addEventListener("keydown", onKeyDown);
if (isGodModeEnabled()) {
    window.bindersConfig.god = true;
}

maybeSetupPerformanceObservers();

window.videoFormatOverride = getQueryStringVariable("videoFormat");
