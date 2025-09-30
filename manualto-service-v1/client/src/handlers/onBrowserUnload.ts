import eventQueue from "@binders/client/lib/react/event/EventQueue";

const onBrowserUnload = (): void => {
    eventQueue.flushQueue(true);
};

export default onBrowserUnload;
