/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as bcrypt from "bcryptjs";

import {PasswordHash, PasswordHashAlgorithms} from "./model";

export class BCryptPasswordHash extends PasswordHash {

    private static defaultCost = 10;

    constructor(private hash: string) {
        super();
        this.hash = hash;
    }

    serializeDetails() { return this.hash; }

    getAlgorithm() {
        return PasswordHashAlgorithms.BCRYPT;
    }

    static fromSerializedDetails(serializedDetails: string) {
        return new BCryptPasswordHash(serializedDetails);
    }

    static create(plainText: string, cost: number = BCryptPasswordHash.defaultCost): Promise<BCryptPasswordHash> {
        return new Promise(
            function(resolve, reject) {
                bcrypt.hash(plainText, cost, function(err, hash) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(new BCryptPasswordHash(hash));
                    }
                });
            }
        );
    }

    validate(plainText: string): Promise<boolean> {
        const hash = this.hash;
        return new Promise(
            function(resolve, reject) {
                bcrypt.compare(plainText, hash, function(err, valid) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(valid);
                    }
                });
            }
        );
    }
}