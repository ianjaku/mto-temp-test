import * as React from "react";
import type { FC, PropsWithChildren } from "react";
import { createContext, useContext } from "react";
import BinderClass from "@binders/client/lib/binders/custom/class";
import type { IBinderUpdate } from "../documents/Composer/helpers/binderUpdates";

type BinderUpdateContext = {
    binder: BinderClass;
    updateBinder: (update: IBinderUpdate) => void;
}

const context = createContext<BinderUpdateContext>({
    binder: null,
    updateBinder: null,
});

export const BinderUpdateProvider: FC<PropsWithChildren<BinderUpdateContext>> = (props) => {
    return (
        <context.Provider value={props}>
            {props.children}
        </context.Provider>
    )
}

export const useBinderUpdate = (): BinderUpdateContext => {
    const ctx = useContext(context);
    if (!ctx.updateBinder) {
        throw new Error("useBinderUpdate was used, but BinderUpdateProvider was not initialized. Make sure it exists in the hierarchy above and all properties are set");
    }
    return ctx;
}

