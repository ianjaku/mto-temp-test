import { Either } from "./either";
import { InvalidOperation } from "../util/errors";
import { isEquals } from "./equals";

export class MaybeUnpackError extends Error {
    static readonly NAME = "MaybeUnpackError";

    constructor(public readonly errors: Error[]) {
        super();
        this.name = MaybeUnpackError.NAME;
        this.message = "Could not unpack: " + errors.map(error => error.message).join(", ");
    }
}

export interface MaybeMatcher<T, U> {
    just: (t: T) => U;
    nothing: () => U;
}

type UnpackMaybe<T> = T extends Maybe<infer U> ? U : never;

export abstract class Maybe<T> {

    abstract isJust(): boolean;
    abstract get(): T;
    abstract getOrElse(t: T): T;
    abstract equals(other: Maybe<T>): boolean;

    isNothing(): boolean {
        return !this.isJust();
    }

    caseOf<U>(matcher: MaybeMatcher<T, U>): U {
        if (this.isJust()) {
            return matcher.just(this.get());
        }
        else {
            return matcher.nothing();
        }
    }

    lift<U> (f: (t: T) => U): Maybe<U> {
        if (this.isJust()) {
            const u = f(this.get());
            return Maybe.just(u);
        }
        else {
            return Maybe.nothing<U>();
        }
    }

    bind<U> (f: (t: T) => Maybe<U>): Maybe<U> {
        if (this.isJust()) {
            return f(this.get());
        }
        else {
            return Maybe.nothing<U>();
        }
    }

    getOrThrow(error: Error): T {
        if (this.isJust()) {
            return this.get();
        }
        throw error;
    }

    static nothing<A>(): Nothing<A> {
        return new Nothing<A>();
    }

    static just<A>(value: A): Just<A> {
        return new Just<A>(value);
    }

    static unpack<T extends Record<string, Maybe<unknown>>>(packed: T): Either<Error, { [K in keyof T]: UnpackMaybe<T[K]> }> {
        const accumulator = {} as { [K in keyof T]: UnpackMaybe<T[K]> };
        const errors: Error[] = [];
        for (const key in packed) {
            const value = packed[key];
            value.caseOf({
                nothing: () => { errors.push(new Error(`Value for key ${key} not set`)); },
                just: (value: UnpackMaybe<T[Extract<keyof T, string>]>) => { accumulator[key] = value; }
            });
        }
        if (errors.length === 0) {
            return Either.right(accumulator);
        }
        const error = new MaybeUnpackError(errors);
        return Either.left(error);
    }

    static fromUndefinedOrNull<T>(data: T): Maybe<T> {
        return data == null ?
            Maybe.nothing() :
            Maybe.just(data);
    }

    static rejectNothings<T>(list: Maybe<T>[]): T[] {
        return list.filter(m => m.isJust()).map(m => m.get());
    }

    static whenAll<T, U>(maybes: Maybe<T>[], mapper: (args: T[]) => U): Maybe<U> {
        if (maybes.find(m => m.isNothing())) {
            return Maybe.nothing();
        }
        return Maybe.just(mapper(maybes.map(m => m.get())));
    }

    static whenBoth<T, U>(left: Maybe<T>, right: Maybe<T>, mapper: (left: T, right: T) => U): Maybe<U> {
        if (left.isNothing() || right.isNothing()) {
            return Maybe.nothing();
        }
        return Maybe.just(mapper(left.get(), right.get()));
    }

}

export class Just<T> extends Maybe<T> {

    isJust(): boolean {
        return true;
    }

    private readonly value: T;

    constructor(value: T) {
        super();
        this.value = value;
    }

    get(): T {
        return this.value;
    }

    getOrElse(_t: T): T {
        return this.get();
    }

    equals(other: Maybe<T>): boolean {
        if (other.isNothing()) {
            return false;
        }
        const toCompare = other.get();
        if (isEquals(this.value)) {
            return this.value.equals(toCompare);
        }
        return toCompare === this.value;
    }
}

export class Nothing<T> extends Maybe<T> {

    isJust(): boolean {
        return false;
    }

    get(): T {
        throw new InvalidOperation("Nothing.get");
    }

    getOrElse(t: T): T {
        return t;
    }

    equals(other: Maybe<T>): boolean {
        return other.isNothing();
    }
}
