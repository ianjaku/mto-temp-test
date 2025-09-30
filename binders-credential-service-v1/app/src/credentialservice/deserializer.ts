import { PasswordHash, PasswordHashAlgorithms, PlainTextPassword } from "./model";
import { BCryptPasswordHash } from "./bcrypthash";
import { InvalidArgument } from "@binders/client/lib/util/errors";

export class PasswordHashDeserializer {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static deserialize(serializedHash): PasswordHash {
        const deserialized = JSON.parse(serializedHash);
        const algorithm = deserialized.algorithm;
        if (algorithm === PasswordHashAlgorithms.PLAINTEXT) {
            return PlainTextPassword.fromSerializedDetails(deserialized.details);
        }
        if (algorithm === PasswordHashAlgorithms.BCRYPT) {
            return BCryptPasswordHash.fromSerializedDetails(deserialized.details);
        }
        throw new InvalidArgument("Could not deserialize password hash." + serializedHash);
    }
}