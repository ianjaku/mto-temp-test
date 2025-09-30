import * as React from "react";
import Login from "./application/Login";
import { render } from "react-dom";
import "./styles/main.css";

if (window && window.productionMode === true) {
    // eslint-disable-next-line no-undef
    let process = require("process/browser.js");
    process.env.NODE_ENV = "production";
}

render(<Login />, document.getElementById("app"));
