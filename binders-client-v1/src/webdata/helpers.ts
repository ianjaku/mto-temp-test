import { IWebData, MultiWebData, WebDataState } from ".";
import { isDev } from "../util/environment";


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function checkWebDataTransition<T>(componentName: string, fromData?: IWebData<T>, toData?: IWebData<T>) {
    if (!isDev() || !fromData || !toData || !fromData.isMulti || !toData.isMulti) {
        return;
    }
    if (fromData.state === WebDataState.SUCCESS && toData.state === WebDataState.PENDING) {
        const partialKeys = (toData as MultiWebData<T>).pendingPartialKeys.join();
        // eslint-disable-next-line no-console
        console.error(`Warning: WebData in component ${componentName} transitioned from SUCCESS back to PENDING, caused by keys ${JSON.stringify(partialKeys)}. This might make components down the tree remount, leading to effects (like API calls) being fired more than once.`);
    }
}
