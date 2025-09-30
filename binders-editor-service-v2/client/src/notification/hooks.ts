import {
    APIDeleteNotificationTemplate,
    APIFindNotificationTargets,
    APIFindNotificationTemplatesForAccount,
    client
} from  "./api";
import {
    NotificationTarget,
    NotificationTemplate
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { UseMutationResult, UseQueryResult, useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { APIGetAncestors } from "../browsing/api";
import { useActiveAccountId } from "../accounts/hooks";

const serviceName = "@binders/tracking-v1";

export const useNotificationTemplates = (): {
    templates: NotificationTemplate[],
    loadTemplates: () => Promise<void>;
    deleteTemplate: (templateId: string) => Promise<void>;
} => {
    const accountId = useActiveAccountId();
    const [templates, setAvailableTemplates] = useState<NotificationTemplate[]>([]);
    
    const loadTemplates = useCallback(async () => {
        const templates = await APIFindNotificationTemplatesForAccount(accountId);
        setAvailableTemplates(templates);
    }, [accountId]);

    useEffect(  () => {
        loadTemplates()
    }, [accountId, loadTemplates]);

    return {
        templates,
        loadTemplates,
        async deleteTemplate(templateId: string) {
            await APIDeleteNotificationTemplate(accountId, templateId);
            setAvailableTemplates(templates => templates.filter(t => t.templateId !== templateId));
        }
    };
}

export const useNotificationTargets = (
    binderId: string
): UseQueryResult<NotificationTarget[]> => {
    const accountId = useActiveAccountId();
    return useQuery(
        [serviceName, "notificationtargets", binderId],
        async () => {
            const ancestors = await APIGetAncestors(binderId);
            return await APIFindNotificationTargets(accountId, Object.keys(ancestors));
        }
    );
}

export const useSendPublisRequestNotification = (
): UseMutationResult<void, unknown, { binderId: string }> => {
    const accountId = useActiveAccountId();
    return useMutation({
        mutationFn: (params) => {
            return client.sendPublishRequestNotification(
                accountId,
                params.binderId
            )
        },
    });
}
