export class InvalidArgument extends Error {

    static errorName = "InvalidArgument";

    constructor(message: string) {
        super();
        this.message = message;
        this.name = InvalidArgument.errorName;
        Object.setPrototypeOf(this, InvalidArgument.prototype);  // ES5 >= requirement
    }
}

export class InvalidOperation extends Error {

    static errorName = "InvalidOperation";

    constructor(message: string) {
        super();
        this.message = message;
        this.name = InvalidOperation.errorName;
        Object.setPrototypeOf(this, InvalidOperation.prototype);  // ES5 >= requirement
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const patchErrorPrototype = () => {
    if (!("toJSON" in Error.prototype)) {

        // tslint:disable:no-invalid-this
        Object.defineProperty(Error.prototype, "toJSON", {
            value: function () {
                const alt = {};

                Object.getOwnPropertyNames(this).forEach(function (key) {
                    alt[key] = this[key];
                }, this);

                return alt;
            },
            configurable: true,
            writable: true
        });
        // tslint:enable:no-invalid-this
    }
};

patchErrorPrototype();