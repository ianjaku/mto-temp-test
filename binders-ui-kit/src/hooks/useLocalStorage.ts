import { useState } from "react"

const getValueFromLocalStorage = (key: string) => {
    const value = localStorage.getItem(key);
    if (value == null) return null;
    return JSON.parse(value);
}

export const useLocalStorage = <T>(
    localStorageKey: string,
    defaultValue: T = null
): [T, (v: T) => void] => {
    const [currentValue, setCurrentValue] = useState(getValueFromLocalStorage(localStorageKey) ?? defaultValue);

    const setValue = (value: T) => {
        localStorage.setItem(localStorageKey, JSON.stringify(value));
        setCurrentValue(value);
    }

    return [currentValue, setValue]
}
