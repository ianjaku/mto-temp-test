import * as fs from "fs";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const libGlob = require("glob");

export function fileExists(toCheck: string): Promise<boolean> {
    return new Promise<boolean>( (resolve, reject) => {
        fs.stat(toCheck, function(err) {
            if (err) {
                if (err.code === "ENOENT") {
                    resolve(false);
                }
                else {
                    reject(err);
                }

            }
            else {
                resolve(true);
            }
        });
    });
}

export function glob(pattern: string): Promise<string[]> {
    return libGlob(pattern);
}
