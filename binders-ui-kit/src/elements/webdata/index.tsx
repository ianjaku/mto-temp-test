import * as React from "react";
import { WebData, WebDataRenderOptions, defaultRenderOptions } from "@binders/client/lib/webdata";
import Loader from "../loader";
import "../loader/loader.styl";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class WebDataComponent<T, Props = any> extends React.Component<Props, any> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public renderNotAsked(initMessage: string, hideLoader: boolean) {
        return this.renderPending(initMessage, hideLoader);
    }

    public renderPending(
        loadingMessage: string,
        hideLoader: boolean,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        incompleteData?: T
    ): JSX.Element {
        return hideLoader ?
            <div /> :
            <Loader text={loadingMessage} />;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public abstract renderSuccess(data: T);
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public abstract renderFailure(error: Error, incompleteData?: T);

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public renderWebData(webData: WebData<T>, options?: Partial<WebDataRenderOptions>) {
        options = Object.assign({}, defaultRenderOptions, options || {});
        const { hideLoader, initMessage, loadingMessage } = options;
        return webData.case({
            NotAsked: () => this.renderNotAsked(initMessage, hideLoader),
            Pending: (_uid: string, incompleteData: T) => this.renderPending(loadingMessage, hideLoader, incompleteData),
            Success: (data: T) => this.renderSuccess(data),
            Failure: (error, _uid: string, incompleteData?: T) => this.renderFailure(error, incompleteData),
        });
    }

}