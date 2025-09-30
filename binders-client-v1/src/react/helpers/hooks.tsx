import * as React from "react";
import { ReduceStore } from "flux/utils";
import isEqual from "lodash.isequal";

const { useCallback, useEffect, useMemo, useState, useReducer, useRef } = React;

export function useAnimateVisibility(initialVisibility: boolean, options?: { delayMs?: number }): {
    isVisible: boolean,
    shouldRender: boolean,
    setVisibility: (newVisibility: boolean) => void,
} {
    const [shouldRender, setShouldRender] = useState(initialVisibility);
    const [hasRendered, setHasRendered] = useState(initialVisibility);
    const [visible, setVisible] = useState(initialVisibility);
    const delayMs = options?.delayMs ?? 500;
    const setVisibility = useCallback((newVisibility: boolean) => {
        if (!newVisibility && visible) {
            setVisible(false);
            setHasRendered(false);
            setTimeout(() => setShouldRender(false), delayMs);
        } else if (newVisibility && !visible) {
            setVisible(true);
            setShouldRender(true);
            setHasRendered(false);
            setTimeout(() => setHasRendered(true), delayMs);
        }
    }, [delayMs, visible]);
    return {
        isVisible: hasRendered,
        shouldRender,
        setVisibility,
    };
}

export function usePrevious<T>(value: T): T {
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

// useFluxStore combines useReducer and useEffect to use with FluxStores
// useReducer: Used to extract relevant values from the store
// useEffect is used to attach a listener to the store
export type Reducer<P, S extends ReduceStore<unknown, unknown>> = (previousState: P, store: S) => P;
function useFluxStore<S extends ReduceStore<unknown, unknown>, P>(store: S, reducer: Reducer<P, S>, strictEquality = false) {
    // We use Lodash's isEqual check to make sure the state hasn't changed
    // This can be expensive, but cheaper than a re-render
    function reducerWithEqualityCheck(_p: P, _store: S): P {
        const refreshVal = reducer(_p, _store);

        if (isEqual(refreshVal, _p)) return _p;
        return refreshVal;
    }

    const [out, _dispatch] = useReducer(
        strictEquality ? reducerWithEqualityCheck : reducer,
        reducer(null, store),
    );

    const dispatch = useMemo(() => {
        const dp: React.Dispatch<S> = _dispatch;
        return dp;
    }, [_dispatch]);

    // Watch dependencies, and dispatch if they change
    useMemo(() => {
        dispatch(store);
    }, [store, dispatch]);

    useEffect(() => {
        // Listener that is called when store is updated
        function listener() {
            // We dispatch the store to the reducer
            dispatch(store);
        }

        // Attach listener to store
        const token = store.addListener(listener);

        // This avoids potentially missing an update between useReducer --> render --> useEffect
        dispatch(store);

        // On useEffect destruction, remove the listener
        // Use arrow function otherwise EventEmitter blows up
        return () => token.remove();
    }, [dispatch, store]);
    // We make sure to pass [] so we're not attaching/detaching on every render

    return out; // Reducer value gets returned to useFluxStore
}

export function useFluxStoreAsAny<S extends ReduceStore<unknown, unknown>, P, N>(
    store: S,
    extractor: (prev: P, store: S) => N,
): N {
    return useFluxStore<S, P>(store, extractor as unknown as Reducer<P, S>) as unknown as N;
}
