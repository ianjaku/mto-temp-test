/* eslint-disable no-console */

import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import BitmovinApi from "@bitmovin/api-sdk";

const doIt = async () => {
    const config = BindersConfig.get();
    const bitmovinApi = new BitmovinApi({
        apiKey: config.getString("bitmovin.apiKey").get(),
    });

    let count = 0;
    let times = 100;
    while (times > 0) {
        times--;
        const encodings = await bitmovinApi.encoding.encodings.list({
            limit: 100,
            status: "FINISHED",
            offset: count
        });
        if (encodings.items.length === 0) {
            break;
        }
        count += encodings.items.length;
        console.log("Fetch! :)")
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("Total number of encodings:", count);
}

doIt()
    .then(() => console.log("Done!"));