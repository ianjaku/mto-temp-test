

export async function getChar(question: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const readline = require("readline");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise( resolve => {
        rl.question(question, (answer) => {
            resolve(answer);
            rl.close();
        });
    });
}