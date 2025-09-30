import * as React from "react";
import {
    BinderLanguageComputedProperties,
    useBinderLanguageProperties as useComputeBinderLanguageProperties,
} from "./useBinderLanguageProperties";
import {
    BinderLanguageOperations,
    useBinderLanguageOperations as useBuildBinderLanguageOperations,
} from "./useBinderLanguageOperations";
import { FC, ReactNode, useContext, useEffect } from "react";
import { FEATURE_READER_TITLE_CHUNK } from "@binders/client/lib/clients/accountservice/v1/contract";
import { IBinderLanguageProps } from "../components/BinderLanguage/types";
import { checkLanguageAvailability } from "../../../machinetranslation/helpers";
import { useActiveAccountFeatures } from "../../../accounts/hooks";
import { useSupportedLanguagesMap } from "../../../machinetranslation/useSupportedLanguagesMap";

type BinderLanguagePropsContextType = {
    computed: BinderLanguageComputedProperties;
    operations: BinderLanguageOperations;
    props: IBinderLanguageProps;
}

const BinderLanguagePropsContext = React.createContext<BinderLanguagePropsContextType>({
    props: {} as IBinderLanguageProps,
    computed: {} as BinderLanguageComputedProperties,
    operations: {} as BinderLanguageOperations,
});

export const BinderLanguagePropsContextProvider: FC<{
    children: ReactNode;
    props: IBinderLanguageProps;
}> = ({ children, props }) => {
    const computed = useComputeBinderLanguageProperties(props);
    const operations = useBuildBinderLanguageOperations(props, computed);
    const features = useActiveAccountFeatures();
    const ignoreTitleMirroring = features.includes(FEATURE_READER_TITLE_CHUNK);

    const { binder } = props;

    const {
        chunk1EqualsTitle,
        chunkApprovals,
        chunkCount,
        opposingChunk1EqualsTitle,
    } = computed;

    const {
        resetApprovalFn,
        setAllowMachineTranslation,
        setIsTitleMirroringMode,
    } = operations;

    const { languageCode, opposingLanguageCode } = props;

    useEffect(() => {
        if (typeof resetApprovalFn === "function") {
            resetApprovalFn();
        }
    }, [binder, chunkApprovals, resetApprovalFn]);

    useEffect(() => {
        if (ignoreTitleMirroring) return;
        if (chunk1EqualsTitle && (opposingChunk1EqualsTitle === true || opposingChunk1EqualsTitle === undefined) && chunkCount <= 1) {
            setIsTitleMirroringMode(true);
        } else {
            setIsTitleMirroringMode(false);
        }
    }, [chunk1EqualsTitle, ignoreTitleMirroring, opposingChunk1EqualsTitle, setIsTitleMirroringMode, chunkCount]);

    const supportedLanguagesMap = useSupportedLanguagesMap();
    useEffect(() => {
        if (languageCode && opposingLanguageCode && supportedLanguagesMap) {
            const availableTranslation = checkLanguageAvailability(supportedLanguagesMap, languageCode, opposingLanguageCode)
            setAllowMachineTranslation(availableTranslation)
        }
    }, [languageCode, opposingLanguageCode, setAllowMachineTranslation, supportedLanguagesMap])

    return (
        <BinderLanguagePropsContext.Provider value={{ props, computed, operations }}>
            {children}
        </BinderLanguagePropsContext.Provider>
    );
}

const useBinderLanguageContext = (): BinderLanguagePropsContextType =>
    useContext(BinderLanguagePropsContext);

export const useBinderLanguageProps = (): IBinderLanguageProps => {
    const { props } = useBinderLanguageContext();
    return props;
}

export const useBinderLanguageOperations = (): BinderLanguageOperations => {
    const { operations } = useBinderLanguageContext();
    return operations;
}

export const useBinderLanguageComputedProps = (): BinderLanguageComputedProperties => {
    const { computed } = useBinderLanguageContext();
    return computed;
}
