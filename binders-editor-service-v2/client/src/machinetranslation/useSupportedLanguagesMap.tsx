import { useEffect, useState } from "react";
import { APIGetSupportedLanguagesByEngine } from "./api";

export function useSupportedLanguagesMap(): { [engineType: string]: string[] } {
    const [supportedLanguagesMap, setSupportedLanguagesMap] = useState(undefined);
    useEffect(() => {
        APIGetSupportedLanguagesByEngine().then(supLang => setSupportedLanguagesMap(supLang));
    }, []);
    return supportedLanguagesMap;
}