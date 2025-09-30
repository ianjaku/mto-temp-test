export abstract class EntityIdentifier<T> {
    protected key: T;
    constructor(id: T) {
        this.assert(id);
        this.key = id;
    }

    protected abstract assert(key: T): void ;

    value(): T {
        return this.key;
    }
}