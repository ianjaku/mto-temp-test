import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

import { testCss } from "./csshandler";

const config = BindersConfig.get();

// eslint-disable-next-line no-console
testCss(config, "siemens").then(css => console.log("ALL GOOD!", css)).catch(error => console.log("FAIL!", error));
