// eslint-disable-next-line sort-imports
import * as React from "react";
import Router from "./routes";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import { maybeSetupPerformanceObservers } from "@binders/client/lib/performance/resourceTimings";
import { render } from "react-dom";
import { trackingClient } from "./tracking/api";

import "@binders/client/lib/react/i18n";

eventQueue.setAuthTokenProvider(() => trackingClient.createLogAuthToken());

if (window && window.productionMode === true) {
    // eslint-disable-next-line no-undef
    let process = require("process/browser.js");
    process.env.NODE_ENV = "production";
}

maybeSetupPerformanceObservers();

render( <Router />, document.getElementById("app"));

