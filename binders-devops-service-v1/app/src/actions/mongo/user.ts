/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { RunMongoScriptConfig, runMongoScriptInPod } from "./script";
import { dumpFile } from "../../lib/fs";
import { getAdminCredentials } from "./config";
import { getAllMongoUsers } from "../../lib/bindersconfig";
import log from "../../lib/logging";
import { unlinkSync } from "fs";

export type RoleType = "clusterMonitor" | "read" | "readWrite" | "root" | "backup" | "restore";

export const MONGO_ADMIN_LOGIN = "admin"

export interface DBRole {
    role: RoleType;
    db: string;
}

export type Role = DBRole | RoleType;


const runMongoScript = async (config: RunMongoScriptConfig) => {
    const { adminPassword, contents } = config

    let adminLogin = config.adminLogin
    if (!adminLogin) {
        adminLogin = MONGO_ADMIN_LOGIN
    }
    const scriptContents = `
    conn = new Mongo();
    db = conn.getDB("admin");
    db.auth("${adminLogin}", "${adminPassword}")
    ${contents}
    `;
    const location = `/tmp/mongo-script-${generateNewPassword()}.js`;
    await dumpFile(location, scriptContents);
    try {
        return await runMongoScriptInPod({
            ...config,
            location
        });
    } finally {
        unlinkSync(location);
    }
};

interface UserConfig {
    login: string;
    password: string;
    roles: Role[];
}

interface CreatePasswordConfig {
    adminLogin: string
    adminPassword: string
    authenticated: boolean
    forceReplicaSet: boolean
    namespace: string
    users: UserConfig[]
}

export const createUsers = async (config: CreatePasswordConfig) => {
    const { adminLogin, adminPassword, forceReplicaSet, authenticated, users, namespace } = config;
    const contents = [];
    for (const user of users) {
        const { login, password, roles } = user;
        contents.push(`
        db.createUser( {
            user: "${login}",
            pwd: "${password}",
            roles: ${JSON.stringify(roles)}
        });
        `);
    }
    await runMongoScript({
        adminLogin,
        adminPassword,
        contents: contents.join("\n"),
        authenticated,
        forceReplicaSet,
        namespace
    })
};


interface UpdatePasswordConfig {
    adminLogin: string
    adminPassword: string
    forceReplicaSet: boolean
    login: string
    namespace: string
    password: string
}
export const updatePassword = async (config: UpdatePasswordConfig) => {
    const { adminLogin, adminPassword, forceReplicaSet, namespace, login, password } = config
    const newPassword = password ? password : generateNewPassword()

    const scriptContents = `
    db.getSiblingDB("admin").runCommand({
        updateUser: "${login}",
        pwd: "${password}",
        mechanisms: ["SCRAM-SHA-1", "SCRAM-SHA-256"]
    });
    `;
    await runMongoScript({
        adminLogin,
        adminPassword,
        contents: scriptContents,
        authenticated: true,
        forceReplicaSet,
        namespace
    });
    return newPassword;
};

const generateNewPassword = () => {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 15; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

export const createUsersWithPassword = async (config: CreatePasswordConfig) => {
    const users = config.users;
    for (const user of users) {
        const { password } = user;
        const newPassword = password ? password : generateNewPassword();
        user.password = newPassword;
    }
    await createUsers(config);
};

export const createBackupUsers = async (adminLogin: string, adminPassword: string, namespace: string, forceReplicaSet = false, credentials?: Record<string, string>) => {
    await createUsersWithPassword({
        adminLogin,
        adminPassword,
        authenticated: true,
        forceReplicaSet,
        users: getBackupUsers(credentials),
        namespace,
    });
};

export const getBackupUsers = (credentials?: Record<string, string>): UserConfig[] => {
    const backupPassword = credentials && credentials["backup-operator"] ? credentials["backup-operator"] : undefined;
    const restorePassword = credentials && credentials["restore-operator"] ? credentials["restore-operator"] : undefined;
    return [{
        login: "backup-operator",
        password: backupPassword,
        roles: ["backup"]
    }, {
        login: "restore-operator",
        password: restorePassword,
        roles: ["restore"]
    }]
}

export const createMongoSuperAdmin = async (namespace: string, credentials?: Record<string, string>, forceReplicaSet?: boolean) => {
    log("Creating cluster admin user");
    let login, password
    if (credentials && credentials[MONGO_ADMIN_LOGIN]) {
        login = MONGO_ADMIN_LOGIN
        password = credentials[MONGO_ADMIN_LOGIN]
    } else {
        const envCredentials = getAdminCredentials();
        login = envCredentials.login
        password = envCredentials.password
    }
    const roles: Role[] = [{ role: "root", db: "admin" }];
    const adminPassword = credentials ? credentials[MONGO_ADMIN_LOGIN] : undefined;
    const users = [{
        login,
        password,
        roles
    }];
    await createUsers({ namespace, users, adminPassword, authenticated: false, forceReplicaSet, adminLogin: MONGO_ADMIN_LOGIN }); // todo check if this adminLogin is needed here?
};

export function extractAdminCredentials(credentials: Record<string, string>) {
    if (credentials && credentials[MONGO_ADMIN_LOGIN]) {
        return credentials[MONGO_ADMIN_LOGIN]
    }
    throw new Error("No admin credentials provided")
}

export async function createMongoUsersFromSecrets(credentials: Record<string, string>, namespace: string) {
    const allServices = getAllMongoUsers();
    const forceReplicaSet = false
    const adminLogin = MONGO_ADMIN_LOGIN
    const adminPassword = extractAdminCredentials(credentials);
    const users: UserConfig[] = allServices.map(service => ({
        login: service,
        password: credentials[service],
        roles: [{ role: "readWrite", db: service }]
    }));
    users.push({
        login: "prometheus",
        password: credentials["prometheus"],
        roles: [
            { role: "clusterMonitor", db: "admin" },
            { role: "read", db: "local" }
        ]
    });
    users.push(...getBackupUsers(credentials));
    await createUsersWithPassword({
        adminLogin,
        adminPassword,
        authenticated: true,
        forceReplicaSet,
        namespace,
        users
    });
}