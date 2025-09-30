
export abstract class RepositoryObserver<T> {

    abstract onCreate(data: T[]): void;
    abstract onChange(data: T[]): void;
    abstract onRemove(ids: string[]): void;
    
}
