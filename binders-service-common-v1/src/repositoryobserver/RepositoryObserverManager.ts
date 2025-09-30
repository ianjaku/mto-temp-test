import { RepositoryObserver } from "./RepositoryObserver";

export class RepositoryObserverManager<T> {

    constructor(
        private repositoryObservers: RepositoryObserver<T>[]
    ) {}

    markCreated(data: T[]): void {
        this.repositoryObservers.forEach(async o => o.onCreate(data));
    }

    markChanged(data: T[]): void {
        this.repositoryObservers.forEach(async o => o.onChange(data));
    }

    markRemoved(ids: string[]): void {
        this.repositoryObservers.forEach(async o => o.onRemove(ids));
    }
}
