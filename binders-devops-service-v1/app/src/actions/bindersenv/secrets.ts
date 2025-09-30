/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { listSecrets } from "../k8s/secrets";

const MONGO_CREDENTIALS_SECRET_PREFIX = "credentials-mongo-";

export const getMongoCredentialsSecretName = suffix => `${MONGO_CREDENTIALS_SECRET_PREFIX}${suffix}`;

export const getMongoCredentials = async (namespace: string) => {
    const allSecrets = await listSecrets(namespace);
    return allSecrets
        .filter(secret => secret.metadata.name.startsWith(MONGO_CREDENTIALS_SECRET_PREFIX))
        .reduce( (credentials, secret) => {
            const decode = enc => Buffer.from(enc, "base64").toString();
            const login = decode(secret.data.login);
            const password = decode(secret.data.password);
            return { ...credentials, [login]: password};
        }, {});

};