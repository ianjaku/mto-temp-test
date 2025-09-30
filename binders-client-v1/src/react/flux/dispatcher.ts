import {Dispatcher} from "flux";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dispatcher = new Dispatcher<any>();
export default dispatcher;

export const unsafeDispatch = dispatcher.dispatch.bind(dispatcher);

const actionQueue = [];

const processQueue = () => {

    if (!dispatcher.isDispatching()) {
        const action = actionQueue.shift();
        if (action === undefined) {
            return;
        }
        unsafeDispatch(action);
        processQueue();
    } else {
        setTimeout(processQueue, 1);
    }
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const dispatch = (action): void => {
    actionQueue.push(action);
    processQueue();
};
