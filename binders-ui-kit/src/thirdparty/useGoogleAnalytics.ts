import { useEffect } from "react";

const LOCALSTORAGE_KEY = "google-tag-consent";

function gtagFunc() {
    // eslint-disable-next-line prefer-rest-params, @typescript-eslint/no-explicit-any
    (window as any).dataLayer.push(arguments);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gtag: any = gtagFunc;

export const useGoogleAnalytics = (
    hasConsent: boolean
): void => {

    useEffect(() => {
        const consentValue = hasConsent ? "granted" : "denied";
        if (localStorage.getItem(LOCALSTORAGE_KEY) === consentValue) return;
        localStorage.setItem(LOCALSTORAGE_KEY, consentValue);

        gtag("consent", "update", {
            "ad_storage": "denied",
            "analytics_storage": consentValue,
            "personalization_storage": "denied"
        });
    }, [hasConsent]);
}
