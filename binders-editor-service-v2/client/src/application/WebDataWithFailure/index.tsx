import * as React from "react";
import FallbackComponent from "../FallbackComponent";
import { WebDataComponent } from "@binders/ui-kit/lib/elements/webdata";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class WebDataWithFailure<S = any, P = any> extends WebDataComponent<S, P> {
    renderFailure(error) {
        return <FallbackComponent msg={error.toString()} />;
    }
}
