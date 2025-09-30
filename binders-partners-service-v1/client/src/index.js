import * as React from "react";
import Router from "./routes";
import { render } from "react-dom";

import "./reset.css";
import "./main.styl";
import "@binders/client/lib/react/i18n";

if (window && window.productionMode === true) {
    // TODO: remove no-undef line, why is it no undef with new build system?
    // eslint-disable-next-line no-undef
    let process = require("process/browser.js");
    process.env.NODE_ENV = "production";
}

render( <Router />, document.getElementById("app"));
