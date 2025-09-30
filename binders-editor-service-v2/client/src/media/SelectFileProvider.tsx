import * as React from "react";
import { FC, ReactNode } from "react";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { createPortal } from "react-dom";
import { getAcceptVisualsString } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { logClientError } from "@binders/client/lib/util/clientErrors";

type SelectFileFunc = (
    options: { multiple?: boolean; accept?: string; },
    callback: (files: File[]) => void
) => void;

interface SelectFileContext {
    selectFile: SelectFileFunc;
}

const selectFileContext = React.createContext<SelectFileContext>({
    selectFile: () => { throw new Error("No SelectFileProvider found.") }
});

export const SelectFileProvider: FC<{ children: ReactNode }> = (props) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    /**
     * Using a ref to prevent the component from re-rendering when this value is changed.
     * The component could be very high up in the tree, making re-rendering expensive.
     */
    const activeJobRef = React.useRef<{
        multiple?: boolean;
        accept?: string;
        callback: (files: File[] | null) => void;
    }>();
    
    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e["dataTransfer"] ? e["dataTransfer"].files : e.target["files"];
        e.persist();
        if (!files) return;
        activeJobRef.current?.callback?.(Array.from(files))
        if (e.target) {
            e.target.value = "";
        }
        activeJobRef.current = undefined;
    }

    const selectFile = React.useCallback(
        (options: { multiple?: boolean; accept?: string }, callback: (files: File[]) => void) => {
            const inputEl = inputRef.current;
            if (inputEl == null) {
                logClientError(Application.EDITOR, "Input element not mounted in SelectFileProvider#selectFile.");
                return;
            }
            // We're setting multiple & accept on the element instead of using state to prevent re-renders
            // and we already need the inputEl anyway
            inputEl.multiple = options.multiple ?? false;
            inputEl.accept = options.accept ?? "*";
            activeJobRef.current = {
                multiple: options.multiple,
                accept: options.accept,
                callback
            }
            inputEl.click();
        },
        []
    );

    return (
        <>
            {createPortal(
                <input 
                    ref={inputRef}
                    type="file"
                    name={"visual"}
                    onChange={onChange}
                    multiple
                    style={{ display: "none" }}
                    accept={getAcceptVisualsString()}
                />,
                document.body
            )}
            <selectFileContext.Provider value={{ selectFile }}>
                {props.children}
            </selectFileContext.Provider>
        </>
    );
}

export const useFileSelector = (): SelectFileFunc => {
    const context = React.useContext(selectFileContext);
    return context.selectFile;
}
