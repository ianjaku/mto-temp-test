import * as React from "react";
import { isBefore, subSeconds } from "date-fns";
import Binder from "@binders/client/lib/binders/custom/class";
import debounce from "lodash.debounce";
import { maybeCleanMarkers } from "../helpers/binder";
import { saveBinder as remoteSaveBinder } from "../../actions/publishing";
import { update as updateBinder } from "@binders/client/lib/binders/custom/class";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";

const { useEffect, useRef, useCallback, useState } = React;

export type SetStateBinderFn = (
    curriedUpdateFn: (b: Binder) => Binder,
    postBinderUpdate?: (b: Binder) => void,
    postBinderSaveCallback?: () => void,
    firstInitialization?: boolean,
    bumpContentVersion?: boolean,
    isEmptyChunk?: boolean,
) => void;

const pendingTimestampUpdates = [];

function maybeApplyPendingTimestampUpdates(binder: Binder) {
    const binderPatch = { modules: { meta: {} } };
    while (pendingTimestampUpdates.length > 0) {
        const updates = pendingTimestampUpdates.shift();
        for (const key in updates) {
            const modules = binder.getModules();
            const metaIndex = modules.meta.findIndex(m => m.key === key);
            if (metaIndex > -1) {
                const metaModule = modules.meta[metaIndex];
                binderPatch.modules.meta[metaIndex] = {
                    $set: {
                        ...metaModule,
                        lastModifiedDate: updates[key]
                    }
                };
            }
        }
    }
    if (Object.keys(binderPatch.modules.meta).length > 0) {
        binder = updateBinder(binder, () => binderPatch, false, true);
    }
    return binder;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStateBinder = (): { stateBinder: Binder, setStateBinder: any } => {
    const [stateBinder, _setStateBinder] = useState<Binder>(undefined);
    const [isDirty, setIsDirty] = useState<boolean>(false);
    const isSaveInProcess = useRef<boolean>(false);
    const lastSaveTime = useRef(subSeconds(Date.now(), 30));
    const refBinder = useRef<Binder>(null);
    const postBinderUpdateRef = useRef<(b: Binder) => void>(null);
    const [postBinderUpdateVersion, setPostBinderUpdateVersion] = useState(0);
    const [postBinderSaveCallback, setPostBinderSaveCallback] = useState<() => void>(null);
    const prevPostBinderUpdateVersion = usePrevious(postBinderUpdateVersion);

    const updateStateBinder = useCallback((curriedUpdateFn: (b: Binder) => Binder, firstInitialization: boolean) => {
        if (refBinder) {
            const binderWithTsUpdate = maybeApplyPendingTimestampUpdates(refBinder.current);
            const newStateBinder = curriedUpdateFn(binderWithTsUpdate);
            _setStateBinder(newStateBinder);
        } else {
            _setStateBinder(b => {
                const binderWithTsUpdate = maybeApplyPendingTimestampUpdates(b);
                const patched = curriedUpdateFn(binderWithTsUpdate);
                return patched;
            });
        }
        // because when we first initialize, we dont want to override last edited etc
        // we just want to initialize statebinder from store here no changes done by now
        if (!firstInitialization) {
            setIsDirty(true);
        }

    }, [_setStateBinder]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedUpdateStateBinder = useCallback(
        debounce(updateStateBinder, 500, { maxWait: 5000 }),
        [updateStateBinder]
    );

    const setStateBinder: SetStateBinderFn = useCallback((
        curriedUpdateFn: (b: Binder) => Binder,
        postBinderUpdate?: (b: Binder) => void,
        postBinderSaveCallback?: () => void,
        firstInitialization = false,
        bumpContentVersion = false,
        isEmptyChunk = false,
    ) => {
        if (bumpContentVersion) {
            updateStateBinder(curriedUpdateFn, firstInitialization);
            if (!isDirty) {
                setIsDirty(!isEmptyChunk);
            }
        } else {
            const updatedBinder = curriedUpdateFn(refBinder.current);
            refBinder.current = updatedBinder;
            debouncedUpdateStateBinder(curriedUpdateFn, firstInitialization);
        }
        if (postBinderUpdate) {
            postBinderUpdateRef.current = postBinderUpdate;
            setPostBinderUpdateVersion(n => n + 1);
        }
        if (postBinderSaveCallback) {
            setPostBinderSaveCallback(() => postBinderSaveCallback);
        }
    }, [debouncedUpdateStateBinder, updateStateBinder, isDirty, setIsDirty]);

    useEffect(() => {
        refBinder.current = stateBinder;
    }, [stateBinder]);

    useEffect(() => {
        if ((postBinderUpdateVersion !== prevPostBinderUpdateVersion) && postBinderUpdateRef.current) {
            postBinderUpdateRef.current(refBinder.current);
        }
    }, [prevPostBinderUpdateVersion, postBinderUpdateVersion]);

    const saveBinder = useCallback(async (binder: Binder) => {
        if (isSaveInProcess.current && isBefore(lastSaveTime.current, subSeconds(Date.now(), 60))) {
            isSaveInProcess.current = false;
        }
        if (!isSaveInProcess.current && binder) {
            isSaveInProcess.current = true;
            const serverBinder = await remoteSaveBinder(binder);
            if (serverBinder) {
                const { updates } = maybeCleanMarkers(binder, serverBinder);
                pendingTimestampUpdates.push(updates);
            }
            lastSaveTime.current = new Date();
            isSaveInProcess.current = false;
            setIsDirty(false);
        } else {
            setTimeout(() => saveBinder(binder), 100);
        }
        return Promise.resolve(true);
    }, [isSaveInProcess, lastSaveTime]);

    const maybeSaveBinder = useCallback(async () => {
        if (stateBinder && isDirty) {
            await saveBinder(stateBinder);
            if (postBinderSaveCallback) {
                postBinderSaveCallback();
                setPostBinderSaveCallback(null);
            }
        }
    }, [isDirty, stateBinder, saveBinder, postBinderSaveCallback]);

    useEffect(() => {
        const interval = setInterval(() => {
            maybeSaveBinder();
        }, 500);
        return () => clearInterval(interval);
    }, [maybeSaveBinder]);

    return {
        stateBinder,
        setStateBinder,
    }
}

export default useStateBinder;
