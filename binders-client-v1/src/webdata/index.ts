import { TranslationKeys } from "../i18n/translations";
import i18next from "../i18n";

export enum WebDataState {
    NOT_ASKED,
    PENDING,
    SUCCESS,
    FAILURE
}

export interface CaseHandler<A, B> {
    NotAsked: () => B;
    Pending: (uid: string, incompleteData?: A) => B;
    Success: (data: A, uid: string) => B;
    Failure: (error: Error, uid: string, incompleteData?: A) => B;
}

export interface WebDataRenderOptions {
    loadingMessage: string;
    initMessage: string;
    hideLoader: boolean;
}

export const defaultRenderOptions: WebDataRenderOptions = {
    loadingMessage: `${i18next.t(TranslationKeys.General_Loading)}...`,
    initMessage: `${i18next.t(TranslationKeys.General_Initializing)}...`,
    hideLoader: false,
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type ComposedWebDataParts<T extends Object> = { [K in keyof T]: IWebData<T[K]> }
// eslint-disable-next-line @typescript-eslint/ban-types
export type ComposedWebData<T extends Object> = WebData<T>;

export interface IWebData<T> {
    pending(uid: string): IWebData<T>;
    success(data: T, uid: string): IWebData<T>;
    fail(error: Error, uid: string): IWebData<T>;
    state: WebDataState;
    data: T;
    incompleteData?: T;
    error: Error;
    case<B>(handler: CaseHandler<T, B>): B;
    uid: string;
    lift(f: (result: T) => T): IWebData<T>;
    isMulti: boolean;
}

function handleCase<T, B>(wd: IWebData<T>, handler: CaseHandler<T, B>) {
    switch (wd.state) {
        case WebDataState.NOT_ASKED:
            return handler.NotAsked();
        case WebDataState.PENDING:
            return handler.Pending(wd.uid, wd.incompleteData);
        case WebDataState.SUCCESS:
            return handler.Success(wd.data, wd.uid);
        case WebDataState.FAILURE:
            return handler.Failure(wd.error, wd.uid, wd.incompleteData);
    }
}

let nextId = 0;
const nextUniqueId = (): string => {
    return "webdata:" + nextId++;
}

export class WebData<T> implements IWebData<T> {

    public isMulti = false;

    lift(f: (result: T) => T): WebData<T> {
        if (this.state === WebDataState.SUCCESS) {
            const updatedData = f(this.data);
            return new WebData(this.state, updatedData, nextUniqueId());
        }
        return this;
    }

    constructor(private status: WebDataState, private result: T | Error, readonly uid: string) {
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static create() {
        return new WebData(WebDataState.NOT_ASKED, undefined, nextUniqueId());
    }

    private versionedUpdate(newState: WebDataState, allowedStates: WebDataState[], data: T | Error, actionUid: string): WebData<T> {
        if (this.uid !== actionUid) {
            return this;
        }
        if (allowedStates.indexOf(this.state) === -1) {
            throw new Error(`Failing state transition to ${WebDataState[newState]}, currently in  ${WebDataState[this.state]}`);
        }
        return new WebData(newState, data, actionUid);
    }

    pending(uid: string): WebData<T> {
        return new WebData(WebDataState.PENDING, undefined, uid);
    }

    success(data: T, uid: string): WebData<T> {
        return this.versionedUpdate(WebDataState.SUCCESS, [WebDataState.PENDING, WebDataState.NOT_ASKED], data, uid);
    }

    fail(error: Error, uid: string): WebData<T> {
        return this.versionedUpdate(WebDataState.FAILURE, [WebDataState.PENDING, WebDataState.NOT_ASKED], error, uid);
    }

    get state(): WebDataState {
        return this.status;
    }

    get isPendingOrNotAsked(): boolean {
        return this.status === WebDataState.PENDING || this.status === WebDataState.NOT_ASKED;
    }

    get data(): T {
        if (this.state !== WebDataState.SUCCESS) {
            throw new Error(`Invalid state, no data: ${WebDataState[this.state]}`);
        }
        return <T>this.result;
    }

    get dataOrUndefined() {
        const state = this.state;
        if (state !== WebDataState.SUCCESS) {
            return undefined;
        }
        return this.data;
    }

    get incompleteData(): T {
        return <T>this.result;
    }

    get error(): Error {
        if (this.state !== WebDataState.FAILURE) {
            throw new Error(`Invalid state, no error: ${WebDataState[this.state]}`);
        }
        return <Error>this.result;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    case<B>(handler: CaseHandler<T, B>) {
        return handleCase(this, handler);
    }

    static compose<T>(parts: ComposedWebDataParts<T>): IWebData<T> {
        return new MultiWebData(parts, nextUniqueId());
    }
}

export class MultiWebData<T> implements IWebData<T> {

    public isMulti = true;

    lift(_f: (result: T) => T): IWebData<T> {
        throw new Error("MultiWebData.lift is, and should not be implemented. To update partials, use updatePartial instead");
    }

    updatePartial(partialKey: keyof T, updatedWebData: IWebData<T[keyof T]>): IWebData<T> {
        const newPartials: ComposedWebDataParts<T> = { ...this.partials, [partialKey]: updatedWebData };
        return new MultiWebData(newPartials, nextUniqueId());
    }

    constructor(private partials: ComposedWebDataParts<T>, readonly uid: string) {

    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    pending() {
        return this.invalidStateChange(WebDataState.PENDING);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    success() {
        return this.invalidStateChange(WebDataState.SUCCESS);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    fail() {
        return this.invalidStateChange(WebDataState.FAILURE);
    }

    private invalidStateChange(state: WebDataState): WebData<T> {
        throw new Error("Invalid operation, cannot change state to: " + state);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    get state() {
        if (this.allInState(WebDataState.SUCCESS)) {
            return WebDataState.SUCCESS;
        }
        if (this.anyInState(WebDataState.FAILURE)) {
            return WebDataState.FAILURE;
        }
        if (this.anyInState(WebDataState.PENDING)) {
            return WebDataState.PENDING;
        }
        return WebDataState.NOT_ASKED;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    get data() {
        const state = this.state;
        if (state !== WebDataState.SUCCESS) {
            throw new Error(`Invalid state, no data: ${WebDataState[state]}`);
        }
        const result: Partial<T> = {};
        for (const k in this.partials) {
            result[k] = this.partials[k].data;
        }
        return result as T;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    get incompleteData() {
        const result: Partial<T> = {};
        for (const k in this.partials) {
            result[k] = this.partials[k].incompleteData;
        }
        return result as T;
    }

    get pendingPartialKeys(): string[] {
        const pendingKeys = [];
        for (const k of Object.keys(this.partials)) {
            if (this.partials[k].state === WebDataState.PENDING) {
                pendingKeys.push(k);
            }
        }
        return pendingKeys;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    get error() {
        for (const k in this.partials) {
            if (this.partials[k].state === WebDataState.FAILURE) {
                return this.partials[k].error;
            }
        }
        throw new Error(`Invalid state, no error: ${WebDataState[this.state]}`);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    case<B>(handler: CaseHandler<T, B>) {
        return handleCase(this, handler);
    }

    private allInState(state: WebDataState) {
        for (const k in this.partials) {
            if (this.partials[k].state !== state) {
                return false;
            }
        }
        return true;
    }

    private anyInState(state: WebDataState) {
        for (const k in this.partials) {
            if (this.partials[k].state === state) {
                return true;
            }
        }
        return false;
    }
}
