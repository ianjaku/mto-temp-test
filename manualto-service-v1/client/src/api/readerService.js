import { doPost } from "@binders/client/lib/clients/request";

export const remoteLog = async (message) => {
    const logUri = "/_status/echo";
    await doPost(logUri, {toEcho: message});
}
