import * as React from "react";

type ClickHandlerContextType = {
    lastClickedElement?: HTMLElement;
};

const ClickHandlerContext = React.createContext<ClickHandlerContextType>({});

export const ClickHandlerContextProvider: React.FC = ({ children }) => {

    const [lastClickedElement, setLastClickedElement] = React.useState<HTMLElement>();

    const onClick = React.useCallback((e) => setLastClickedElement(e.target), []);

    React.useEffect(() => {
        document.addEventListener("click", onClick);
        return () => {
            document.removeEventListener("click", onClick);
        }
    }, [onClick]);

    return (
        <ClickHandlerContext.Provider
            value={{
                lastClickedElement,
            }}
        >
            {children}
        </ClickHandlerContext.Provider>
    );
};

export const useClickHandlerContext = (): ClickHandlerContextType => React.useContext(ClickHandlerContext);
