import { useEffect } from "react"

/**
 * A very small useEffect wrapper that just checks for null.
 * Useful when there are a lot of useEffects next to eachother that just check for null and set a value.
 * 
 * Usage:
 *  useOnChange(testValue, v => doSomething(v));
 * 
 * translates to:
 *  useEffect(() => {
 *      if (testValue == null) return;
 *      doSomething(v);
 *  }, [testValue]); 
 */
export const useOnChange = <T>(
    value: T,
    changeHandler: (value: T) => void,
    ignoreNullishValues = true
): void => {
    useEffect(() => {
        if (value == null && ignoreNullishValues) return;
        changeHandler(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);
}
