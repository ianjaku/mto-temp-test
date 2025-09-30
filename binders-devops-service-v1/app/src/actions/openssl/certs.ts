/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import log from "../../lib/logging";
import { runCommand } from "../../lib/commands";

export const createCACert = (CAKeyFile: string, CACertFile: string) => {
    return runCommand("openssl", [
        "req", "-batch", "-key", CAKeyFile, "-new", "-x509", "-days", "3650",
        "-sha256", "-out", CACertFile, "-extensions", "v3_ca"
    ]);
};

export const createCSRFile = (keyFile: string, csrFile: string) => {
    log("Creating CSR file");
    return runCommand("openssl", [
        "req", "-batch", "-key", keyFile, "-new", "-sha256", "-out", csrFile
    ]);
};

export const signSCRFile = (CACertFile: string, CAKeyFile: string, csrFile: string, certFile: string) => {
    log("Signing CSR file");
    return runCommand("openssl", [
        "x509", "-req", "-CA", CACertFile, "-CAkey", CAKeyFile, "-CAcreateserial",
        "-in", csrFile, "-out", certFile, "-days", "3650"
    ]);
};