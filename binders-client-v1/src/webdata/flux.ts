import * as Immutable from "immutable";
import { WebData, WebDataState } from "./index";
import { dispatch } from "../react/flux/dispatcher";
import { v4 as uuidv4 } from "uuid";

export function getWebDataActionType(prefix: string, state: WebDataState): string {
    return `${prefix}/${WebDataState[state]}`;
}

export async function fluxWrap<T>(f: () => Promise<T>, prefix: string): Promise<T> {
    const uid = uuidv4();

    dispatch({ type: getWebDataActionType(prefix, WebDataState.PENDING), uid });
    try {
        const result = await f();
        try {
            dispatch({
                type: getWebDataActionType(prefix, WebDataState.SUCCESS),
                body: result,
                uid
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
        }
        return result;
    } catch (error) {
        dispatch({
            type: getWebDataActionType(prefix, WebDataState.FAILURE),
            body: error,
            uid
        });
        throw error;
    }
}

function updateWebData(state, action, stateKey) {

    switch (action.type) {
        case getWebDataActionType(stateKey, WebDataState.NOT_ASKED):
            // eslint-disable-next-line no-console
            console.error("Should not receive a dispatch to NOT_ASKED", action, stateKey);
            return state;
        case getWebDataActionType(stateKey, WebDataState.PENDING):
            return state.update(stateKey, wd => wd.pending(action.uid));
        case getWebDataActionType(stateKey, WebDataState.SUCCESS):
            return state.update(stateKey, wd => wd.success(action.body, action.uid));
        case getWebDataActionType(stateKey, WebDataState.FAILURE):
            return state.update(stateKey, wd => wd.fail(action.body, action.uid));
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function updateWebDataState(state, action, stateKeys) {
    for (let i = 0; i < stateKeys.length; i++) {
        const stateKey = stateKeys[i];
        if (action.type.startsWith(`${stateKey}/`) || action.type === stateKey) {
            return updateWebData(state, action, stateKey);
        }
    }
    return state;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function immutableStateFromKeys(keys: string[]): Immutable.Map<string, any> {
    return Immutable.Map<string, WebData<unknown>>(keys.map(key => {
        const webdata = WebData.create();
        return [key, webdata];
    }));
}

