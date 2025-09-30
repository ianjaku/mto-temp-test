// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require("crypto");

export async function calculateIntercomUserHash(userId: string, secretKey: string): Promise<string> {
    if (userId === undefined || secretKey === undefined) {
        return undefined;
    }
    const hmac = crypto.createHmac("sha256", secretKey);
    hmac.update(userId);
    return hmac.digest("hex");
}