import { typeHost, typePath, typeProtocol, typeStrictStruct } from "../types";

import t = require("tcomb");

const proxyEntries = [
    "plant.mission-j.com",
    "plantdev.mission-j.com",
    "plantstaging.mission-j.com",
    "control.mission-j.com",
    "controldev.mission-j.com",
    "controlstaging.mission-j.com",
    "alpla.crate-iot-staging.com",
    "plant-alpla.crate-iot-staging.com",
    "alpla.digital-friend.app",
    "plant-alpla.digital-friend.app",
    "alpla.dev.digital-friend.app",
    "plant-alpla.dev.digital-friend.app",
    "alpla.staging.digital-friend.app",
    "plant-alpla.staging.digital-friend.app",
    "localhost:9998",
    "proxy.dev.binders.media",
];

const proxyEntry = t.struct({
    readerDomain: typeHost,
    readerPath: typePath,
    apiPath: typePath,
    protocol: typeProtocol,
}, { strict: true });

const proxy = typeStrictStruct(proxyEntries, proxyEntry);
export default proxy;