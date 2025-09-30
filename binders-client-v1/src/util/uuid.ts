import * as validator from "validator";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import { Either } from "../monad";
import { InvalidArgument } from "./errors";

export default class UUID {

    private value: string;

    constructor(value: string) {
        if (!validator.isUUID(value)) {
            throw new InvalidArgument(`Invalid uuid: '${value}'`);
        }
        this.value = value;
    }

    toString(): string {
        return this.value;
    }

    static random(): UUID {
        return new UUID(uuidv4());
    }

    /**
     * Creates a UUID based on the combination of namespace and name.
     * 
     * @param namespace Should be in the format of a UUID (ex: 000000000-0000-0000-0000-0000000000000)
     * @param name Can be any string
     */
    static v5(namespace: string, name: string): UUID {
        return new UUID(uuidv5(name, namespace));
    }

    static randomWithPrefix(prefix: string): string {
        return prefix + UUID.random();
    }

    static build(value: string): Either<Error, UUID> {
        try {
            return Either.right<Error, UUID>(new UUID(value));
        }
        catch (error) {
            return Either.left(error);
        }
    }

}