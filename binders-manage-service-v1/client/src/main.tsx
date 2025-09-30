import * as React from "react";
import * as ReactDOM from "react-dom";
import { APILogEvents } from "./api/trackingService";
import { App } from "./app";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import "./datepicker.min.css";
import "./global.css";

ReactDOM.render(
    <App />,
    document.getElementById("react-main")
);
eventQueue.setSendMethod(APILogEvents);

