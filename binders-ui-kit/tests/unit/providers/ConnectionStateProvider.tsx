import * as React from "react";
import { ConnectionStateProvider, useConnectionState } from "../../../src/providers/ConnectionStateProvider";
import { act, render, screen } from "@testing-library/react";
import { useServiceConnectionStore } from "@binders/client/lib/react/serviceconnectionstate/store";

jest.mock("@binders/client/lib/react/serviceconnectionstate/store");

const ONLINE_MSG = "Is Online";
const OFFLINE_MSG = "Is Offline";

const ConnectionStateMsg: React.FC = () => {
    const { isOnline } = useConnectionState();
    return <>{isOnline ? ONLINE_MSG : OFFLINE_MSG}</>;
}

const ConnectionState: React.FC = () => {
    return (
        <ConnectionStateProvider>
            <ConnectionStateMsg/>
        </ConnectionStateProvider>
    );
}

describe("ConnectionStateProvider component", () => {
    it("is online by default", async () => {
        const mockedUserServiceConnectionStore = jest.mocked(useServiceConnectionStore);
        mockedUserServiceConnectionStore.mockReturnValue(true);

        render(<ConnectionState/>);

        expect(await screen.findByText(ONLINE_MSG)).toBeInTheDocument();
    });

    it("changes when online and offline window events are fired", async () => {
        const mockedUserServiceConnectionStore = jest.mocked(useServiceConnectionStore);
        mockedUserServiceConnectionStore.mockReturnValue(true);

        render(<ConnectionState/>);
        act(() => {
            window.dispatchEvent(new Event("offline"));
        });
        expect(await screen.findByText(OFFLINE_MSG)).toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new Event("online"));
        });
        expect(await screen.findByText(ONLINE_MSG)).toBeInTheDocument();
    });

    it("is offline when service connection is faulty", async () => {
        const mockedUserServiceConnectionStore = jest.mocked(useServiceConnectionStore);
        mockedUserServiceConnectionStore.mockReturnValue(false);

        render(<ConnectionState/>);

        expect(await screen.findByText(OFFLINE_MSG)).toBeInTheDocument();
    });

    it("is offline when all connections are faulty", async () => {
        const mockedUserServiceConnectionStore = jest.mocked(useServiceConnectionStore);
        mockedUserServiceConnectionStore.mockReturnValue(false);

        render(<ConnectionState/>);
        act(() => {
            window.dispatchEvent(new Event("offline"));
        });

        expect(await screen.findByText(OFFLINE_MSG)).toBeInTheDocument();
    });
});