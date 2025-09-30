
import * as React from "react";
import { Route, Switch } from "react-router-dom";
import { ManualFromVideo } from "./ManualFromVideo";

export const MANUAL_FROM_VIDEO_ROUTE = "/manualfromvideo"

export const ManualFromVideoRouter = () => (
    <Switch>
        <Route
            path={`${MANUAL_FROM_VIDEO_ROUTE}/*/:collectionId`}
            component={ManualFromVideo}
        />
        <Route
            path={`${MANUAL_FROM_VIDEO_ROUTE}/:collectionId`}
            component={ManualFromVideo}
        />
    </Switch>
);
