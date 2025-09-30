import * as React from "react";
import { ReactNode, useCallback, useState } from "react";
import { omit } from "ramda"

export enum DirtyStateId {
    deviceUserTargets = "deviceUserTargets",
}

type DirtyStateContextType = {
    handleDirtyState: (dirtyStateId: DirtyStateId) => Promise<void>;
    registerDirtyStateHandler: (dirtyStateId: DirtyStateId, handler: () => Promise<void>) => void;
    unregisterDirtyStateHandler: (dirtyStateId: DirtyStateId) => void;
}

const DirtyStateContext = React.createContext<DirtyStateContextType>({
    handleDirtyState: () => Promise.resolve(),
    registerDirtyStateHandler: undefined,
    unregisterDirtyStateHandler: undefined,
});

type Props = {
    children: ReactNode;
};

export const DirtyStateContextProvider = ({ children }: Props): React.ReactElement => {

    const [handlers, setHandlers] = useState<Record<string, () => Promise<void>>>({});

    const registerDirtyStateHandler = useCallback((
        dirtyStateId: DirtyStateId,
        handler: () => Promise<void>
    ) => {
        setHandlers(handlers => ({
            ...handlers,
            [dirtyStateId]: handler,
        }));
    }, []);

    const unregisterDirtyStateHandler = useCallback((dirtyStateId: DirtyStateId) => {
        setHandlers(handlers => omit([dirtyStateId], handlers));
    }, []);

    const handleDirtyState = useCallback(async (dirtyStateId: DirtyStateId) => {
        const handler = handlers[dirtyStateId];
        if (handler) {
            await handler();
            registerDirtyStateHandler(dirtyStateId, undefined);
        }
    }, [handlers, registerDirtyStateHandler]);

    return (
        <DirtyStateContext.Provider
            value={{
                handleDirtyState,
                registerDirtyStateHandler,
                unregisterDirtyStateHandler,
            }}
        >
            {children}
        </DirtyStateContext.Provider>
    );
};

export const useDirtyStateContext = (): DirtyStateContextType => React.useContext(DirtyStateContext);

