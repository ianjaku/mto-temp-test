import { useCallback, useEffect, useState } from "react";
import Binder from "@binders/client/lib/binders/custom/class";
import { detectLanguage } from "./helpers";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";

export enum DetectionStatus {
    idle,
    detecting,
    detectedNewLang,
    detectedOther,
    detectionFail,
}

export default function useConditionallyDetectLanguage(
    trigger: number,
    binder: Binder,
    languageCode: string,
): [DetectionStatus, string | undefined] {

    const [detectedLanguageCodeVersion, setDetectedLanguageCodeVersion] = useState(0);
    const [detectedLanguageCode, _setDetectedLanguageCode] = useState<string>();
    const [isDetecting, setIsDetecting] = useState(false);

    const setDetectedLanguageCode = useCallback((lc: string) => {
        _setDetectedLanguageCode(lc);
        setDetectedLanguageCodeVersion(v => v + 1);
    }, []);

    const [status, setStatus] = useState(DetectionStatus.idle);

    useEffect(() => {
        if (isDetecting) {
            setStatus(DetectionStatus.detecting);
            return;
        }
        if (detectedLanguageCode === null) {
            setStatus(DetectionStatus.detectionFail);
            return;
        }
        if (detectedLanguageCode) {
            setStatus(detectedLanguageCode !== languageCode ?
                DetectionStatus.detectedNewLang :
                DetectionStatus.detectedOther
            );
            return;
        }
        setStatus(DetectionStatus.idle);
    }, [detectedLanguageCodeVersion, detectedLanguageCode, isDetecting, languageCode]);

    const prevTriggerValue = usePrevious(trigger);

    const maybeDetectLanguage = useCallback(async () => {
        setIsDetecting(true);
        try {
            const detectedLanguageCode = await detectLanguage(binder);
            setDetectedLanguageCode(detectedLanguageCode || null);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            setDetectedLanguageCode(null);
        } finally {
            setIsDetecting(false);
        }
    }, [binder, setDetectedLanguageCode]);

    useEffect(() => {
        const prevTrig = prevTriggerValue === undefined ? trigger : prevTriggerValue;
        const triggerOn = trigger > prevTrig;
        if (!triggerOn) {
            return;
        }
        if (triggerOn) {
            maybeDetectLanguage();
        }
    }, [binder, trigger, languageCode, prevTriggerValue, setDetectedLanguageCode, maybeDetectLanguage]);

    useEffect(() => {
        const triggerOff = trigger < (prevTriggerValue || 0);
        if (triggerOff) {
            setStatus(DetectionStatus.idle);
        }
    }, [trigger, prevTriggerValue]);

    return [status, detectedLanguageCode];
}