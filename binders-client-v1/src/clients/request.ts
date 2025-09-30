// eslint-disable-next-line @typescript-eslint/no-var-requires
const agent = require("superagent");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function doPost(uri: string, body: Record<string, any>): Promise<any> {
    let request = agent("POST", uri);
    request = request.set("Accept", "application/json");
    request = request.set("Content-Type", "application/json");
    request = request.send(JSON.stringify(body));
    return new Promise((resolve, reject) => {
        request.end((error, result) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}
