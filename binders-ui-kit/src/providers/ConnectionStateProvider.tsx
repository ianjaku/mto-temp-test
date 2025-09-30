import * as React from "react";
import { useServiceConnectionStore } from "@binders/client/lib/react/serviceconnectionstate/store";

interface ConnectionState {
    isOnline: boolean;
}

const ConnectionStateContext = React.createContext<ConnectionState>(null);

export const ConnectionStateProvider = ({ children }) => {
    const [ hasNetworkAccess, setHasNetworkAccess ] = React.useState(true);
    const isServiceReachable = useServiceConnectionStore(store => store.isReachable);

    React.useEffect(() => {
        const setNetworkAccess = () => setHasNetworkAccess(true);
        const setNoNetworkAccess = () => setHasNetworkAccess(false);

        window.addEventListener("online", setNetworkAccess);
        window.addEventListener("offline", setNoNetworkAccess);

        return () => {
            window.removeEventListener("online", setNetworkAccess);
            window.removeEventListener("offline", setNoNetworkAccess);
        };
    }, []);
    return (
        <ConnectionStateContext.Provider value={{ isOnline: hasNetworkAccess && isServiceReachable }}>
            {children}
        </ConnectionStateContext.Provider>
    );
};

export const useConnectionState = () => React.useContext(ConnectionStateContext);
