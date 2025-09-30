import { exec } from "child_process";

export async function execAsync(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                reject(error);
            }
            if (stderr) {
                console.error(`Error: ${stderr}`);
                reject(stdout);
            }
            if (stdout.trim().length) {
                console.log(stdout);
            }
            resolve(stdout)
        });
    });
}
