import * as https from "https";
import fetch from "node-fetch";
import { log } from "../../lib/logging";


interface UserConfig {
    certificate?: string, // Optional property for SSL
    elasticPassword: string,
    host: string,
    password: string,
    roles: string[],
    username: string,
}

export async function upsertUser(user: UserConfig): Promise<boolean> {
    const { certificate, elasticPassword, host, password, roles, username } = user;

    const agent = certificate ? new https.Agent({ ca: certificate }) : undefined;
    const protocol = certificate ? "https" : "http";
    try {
        const response = await fetch(`${protocol}://${host}:9200/_security/user/${username}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic " + Buffer.from(`elastic:${elasticPassword}`).toString("base64")
            },
            body: JSON.stringify({
                password,
                roles,
            }),
            ...(agent && { agent }), // Spread the agent only if it's defined
        });

        if (!response.ok) {
            throw new Error(`Error creating user: ${response.statusText}`);
        }
        log(`User created: ${username}`);
        return true;
    } catch (error) {
        log(`Error creating user ${username}:`, error);
        return false;
    }
}
