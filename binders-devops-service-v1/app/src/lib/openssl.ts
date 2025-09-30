import { runCommand } from "./commands";

type EncryptFlag = "-e" | "-d";

const runOpenSSLCommand = async (encryptFlag: EncryptFlag, inputFile: string, outputFile: string, password: string) => {
    const options = [
        "-aes-256-cbc", "-md",  "md5", "-a", "-salt", "-k", password
    ];
    await runCommand(
        "openssl",
        [
            "enc", encryptFlag, ...options,
            "-in", inputFile, "-out", outputFile,
        ]
    );
}

export const decrypt = async (encryptedFile: string, decryptedFile: string, password: string): Promise<void> => {
    await runOpenSSLCommand("-d", encryptedFile, decryptedFile, password);
}

export const encrypt = async (decryptedFile: string, encryptedFile: string, password: string): Promise<void> => {
    await runOpenSSLCommand("-e", decryptedFile, encryptedFile, password);
}