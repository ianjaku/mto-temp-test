/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function fixES5FluxContainer<T extends new (...args: any[]) => any>(
    containerClass: T
): T {
    const tmp = containerClass;
    const newClass = function(...args: any[]) {
        return new tmp(...args);
    } as unknown as T;
    newClass.prototype = tmp.prototype;
    (newClass as any).getStores = (tmp as any).getStores;
    (newClass as any).calculateState = (tmp as any).calculateState;
    return newClass;
}
