import * as React from "react";
import { ONE_MINUTE, ONE_SECOND } from "../util/time";
import { useThrottledCallbackWithRef } from "../react/hooks/useThrottledCallbackWithRef";

interface InactivityListener {
    onTimeout: () => void;
    timeoutMinutes: number;
    countdownDurationSeconds?: number;
}

const { useCallback, useEffect, useState } = React;

type InactivityContextType = {
    registerInactivityListener: (listener: InactivityListener) => void;
    countdownSeconds?: number;
    resetLastActivityTime: () => void;
    reset: () => void;
};
const InactivityContext = React.createContext<
    InactivityContextType
>({
    registerInactivityListener: () => { /**/ },
    resetLastActivityTime: () => { /**/ },
    reset: () => { /**/ },
});

type Props = {
    children: React.ReactNode;
};

export const InactivityContextProvider = ({ children }: Props): React.ReactElement => {

    const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
    const [countdownSeconds, setCountdownSeconds] = useState<number | undefined>(undefined);

    const resetLastActivityTime = useThrottledCallbackWithRef(() => {
        setLastActivityTime(Date.now());
    }, ONE_SECOND);

    const reset = () => {
        resetLastActivityTime();
        setCountdownSeconds(undefined);
    };

    const [listeners, setListeners] = useState<InactivityListener[]>([]);

    useEffect(() => {
        for (const eventName of ["mousemove", "mousedown", "keydown"]) {
            document.body.addEventListener(eventName, () => {
                resetLastActivityTime();
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkForInactivity = useCallback(() => {
        if (listeners.length === 0) {
            return;
        }
        const inactivityTime = Date.now() - lastActivityTime;
        let listenersTriggered = 0;
        for (const listener of listeners) {
            if (inactivityTime > listener.timeoutMinutes * 60 * 1000) {
                listenersTriggered++;
                listener.onTimeout();
                continue;
            }
            if (inactivityTime > (listener.timeoutMinutes * 60 * 1000) - (listener.countdownDurationSeconds * 1000)) {
                if (countdownSeconds === undefined) {
                    setCountdownSeconds(listener.countdownDurationSeconds);
                }
            }
        }
        if (listenersTriggered > 0 && listenersTriggered === listeners.length) {
            setLastActivityTime(Date.now());
        }
    }, [countdownSeconds, lastActivityTime, listeners]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            checkForInactivity();
        }, ONE_MINUTE);
        return () => clearInterval(intervalId);
    }, [checkForInactivity]);

    const registerInactivityListener = useCallback((listener: InactivityListener) => {
        setListeners((listeners) => [...listeners, listener]);
    }, []);

    return (
        <InactivityContext.Provider
            value={{
                registerInactivityListener,
                countdownSeconds,
                resetLastActivityTime,
                reset,
            }}
        >
            {children}
        </InactivityContext.Provider>
    );
};

export const useInactivityContext = (): InactivityContextType => React.useContext(InactivityContext);
