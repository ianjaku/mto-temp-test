import * as React from "react";
import { IWebData, WebDataRenderOptions, defaultRenderOptions } from "@binders/client/lib/webdata";
const { useMemo } = React;

function useWebData<T>(
    webData: IWebData<T>,
    renderSuccess: (data: T) => JSX.Element | JSX.Element[],
    renderPending: (loadingMessage: string, hideLoader: boolean, incompleteData?: Partial<T>) => JSX.Element,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderFailure?: (error: any) => JSX.Element,
    options?: Partial<WebDataRenderOptions>,
): JSX.Element | JSX.Element[] {
    const renderOptions = useMemo(() => Object.assign({}, defaultRenderOptions, options || {}), [options]);
    const { hideLoader, initMessage, loadingMessage } = renderOptions;
    return webData.case({
        NotAsked: () => renderPending(initMessage, hideLoader),
        Pending: (_uid: string, incompleteData: T) => renderPending(loadingMessage, hideLoader, incompleteData),
        Success: (data: T) => renderSuccess(data),
        Failure: (error) => renderFailure ? renderFailure(error): null,
    });
}

export default useWebData;