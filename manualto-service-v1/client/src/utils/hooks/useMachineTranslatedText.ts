import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { APITranslateHTMLChunk } from "../../binders/loader";
import { useActiveAccountId } from "../../stores/hooks/account-hooks";

export function useMachineTranslatedText(props: {
    sourceLanguageCode?: string;
    targetLanguageCode?: string;
    text?: string;
}): UseQueryResult<string> {
    const accountId = useActiveAccountId();
    const enabled = props.sourceLanguageCode?.length > 0 &&
        props.targetLanguageCode?.length > 0 &&
        props.text?.length > 0;
    return useQuery({
        queryKey: ["machineTranslateText", props.sourceLanguageCode, props.targetLanguageCode, props.text],
        queryFn: () => APITranslateHTMLChunk(accountId, props.text, props.sourceLanguageCode, props.targetLanguageCode),
        enabled: enabled,
        refetchOnMount: false,
    });
}
