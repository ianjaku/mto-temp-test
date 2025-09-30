import { decrypt as decryptFile, encrypt as encryptFile } from "../../lib/openssl";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { realpathSync } from "fs";

const getOptions = () => {
    const mode = process.argv[2];
    const validModes = Array.from(Object.keys(FILE_MAPPING));
    if (validModes.indexOf(mode) === -1) {
        log("Invalid mode: " + mode);
        log(`Valid modes are '${validModes.join("', '")}'`);
        process.exit(1);
    }
    return { mode, decrypt: (process.argv[3] === "d") };
};

const FILE_MAPPING = {
    // For the production application cluster
    "production": "production.secrets.json",
    // For local dev and staging application cluster
    "staging": "dev.secrets.json",
    // For devops secrets (like http auth for prometheus web frontend)
    "devops": "devops.secrets.json"
};

const doIt = async () => {
    const { mode, decrypt } = getOptions();
    const baseName = FILE_MAPPING[mode];
    const decrypted = realpathSync(__dirname + "/../../config") + "/" + baseName;
    const encrypted = `${decrypted}.enc`;
    const password = process.env["OPENSSL_ENCRYPT_PASSWORD"];
    if (!password) {
        log("Set the password in the environment: OPENSSL_ENCRYPT_PASSWORD");
        process.exit(1);
    }
    if (decrypt) {
        await decryptFile(encrypted, decrypted, password);
    } else {
        await encryptFile(decrypted, encrypted, password);
    }
};

main( doIt );