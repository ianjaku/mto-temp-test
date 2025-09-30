import { runCommand } from "./commands";
import { v4 } from "uuid";

export interface IUser {
    login: string;
    password: string;
}

export const createPasswdFile = async (users: IUser[], filePath?: string): Promise<string> => {
    const file = filePath ? filePath : `/tmp/htpasswd-${v4()}`;
    for (let i = 0; i < users.length; i++) {
        const { login, password } = users[i];
        const head = i === 0 ? ["-c"] : [];
        const args = [ ...head,  "-b", file, login, password];
        await runCommand("htpasswd", args);
    }
    return file;
};