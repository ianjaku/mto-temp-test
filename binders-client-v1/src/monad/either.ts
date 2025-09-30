import { isEquals } from "./equals";

enum LeftOrRight {
    LEFT,
    RIGHT
}

export interface CaseOfMatcher<L, R, U> {
    left: (left: L) => U;
    right: (right: R) => U;
}

export class EitherUnpackError  {
    constructor(public errors: Error[]) { }
}

export class Either<L, R> {

    private constructor(private leftOrRight: LeftOrRight, private value: L| R) { }

    static left<L, R>(value: L): Either<L, R> {
        return new Either<L, R>(LeftOrRight.LEFT, value);
    }

    static right<L, R>(value: R): Either<L, R> {
        return new Either<L, R>(LeftOrRight.RIGHT, value);
    }

    isLeft(): boolean {
        return this.leftOrRight === LeftOrRight.LEFT;
    }

    isRight(): boolean {
        return this.leftOrRight === LeftOrRight.RIGHT;
    }

    lift<T> (f: (right: R) => T): Either<L, T> {
        if (this.isLeft()) {
            return Either.left<L, T>(<L>this.value);
        }
        const newValue = f(<R>this.value);
        return Either.right<L, T>(newValue);
    }

    bind<T> (f: (right: R) => Either<L, T>): Either<L, T> {
        if (this.isLeft()) {
            return Either.left<L, T>(<L>this.value);
        }
        return f(<R>this.value);
    }

    caseOf<U> (caseOfMatcher: CaseOfMatcher<L, R, U>): U {
        if (this.isLeft()) {
            return caseOfMatcher.left(<L>this.value);
        }
        return caseOfMatcher.right(<R>this.value);
    }

    equals(other: Either<L, R>): boolean {
        if (this.isLeft() !== other.isLeft()) {
            return false;
        }
        const toCompare = other.value;
        if (isEquals(this.value)) {
            return this.value.equals(toCompare);
        }
        return toCompare === this.value;
    }
}
