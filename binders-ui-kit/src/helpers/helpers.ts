import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import i18next from "@binders/client/lib/react/i18n";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function debounce(func, wait, immediate) {
    let timeout;
    return function() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        const later = () => {
            timeout = null;
            if (!immediate) {
                func.apply(context, args);
            }
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) {
            func.apply(context, args);
        }
    };
}

export const isIE10Plus = (): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Object.hasOwnProperty.call(window, "ActiveXObject") && !(window as any).ActiveXObject) {
        return true;
    } else {
        return false;
    }
};


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const closestByClassName = (el, ...classNames) => {
    //eslint-disable-next-line
    while (!el.className || classNames.find(className => el.className.indexOf(className) !== -1) === undefined) {
        el = el.parentNode;
        if (!el) {
            return null;
        }
    }
    return el;
}

export function formatTimeFromSeconds(seconds: number, options?: { verbose?: boolean, skipRoundingTo5Minutes?: boolean }): string {
    const makeUnitLabel = (plural, isMinutes?) => {
        const minute = i18next.t(TranslationKeys.General_Minute, { count: plural ? 2 : 1 })
        const second = i18next.t(TranslationKeys.General_Second, { count: plural ? 2 : 1 })
        if (options?.verbose) {
            return isMinutes ? minute : second;
        }
        return isMinutes ?
            i18next.t(TranslationKeys.General_MinuteAbbr) :
            i18next.t(TranslationKeys.General_SecondAbbr);
    }
    if (seconds < 60) {
        return `${seconds} ${makeUnitLabel(seconds !== 1)}`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainderSeconds = seconds % 60;
    const remainderSecondsLabel = remainderSeconds === 0 ?
        "" :
        `${remainderSeconds} ${makeUnitLabel(remainderSeconds > 1)}`;
    const minutesSuffix = seconds === 300 && options?.verbose && !options?.skipRoundingTo5Minutes ? "+" : "";
    return `${minutes}${minutesSuffix} ${makeUnitLabel(minutes !== 1, true)} ${remainderSecondsLabel}`;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isEnterPressed = (e): boolean => {
    const keyCode = e.keyCode || e.which;
    return (e.key === "enter" || keyCode === 13);
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isEscapePressed = (e): boolean => {
    const keyCode = e.keyCode || e.which;
    return (e.key === "Escape" || keyCode === 27);
}
