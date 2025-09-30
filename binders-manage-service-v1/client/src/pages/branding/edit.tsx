import * as React from "react";
import { RouteComponentProps, browserHistory } from "react-router";
import { toastStyles, useToast } from "../../components/use-toast";
import {
    useCreateReaderBranding,
    useGetAccount,
    useGetReaderBranding,
    useUpdateReaderBranding,
} from "../../api/hooks";
import { BrandingEditor } from "../branding-editor";
import { DragDropContext } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";

const BrandingEditFC: React.FC<RouteComponentProps<unknown, { accountId: string; brandingId?: string }>> = (props) => {
    const { accountId, brandingId } = props.params;
    const { toast } = useToast();
    const currentAccount = useGetAccount(accountId);
    const currentBranding = useGetReaderBranding(brandingId)
    const updateBranding = useUpdateReaderBranding({
        onSuccess: (_, props) => {
            toast({ className: toastStyles.info, title: "Branding updated", description: `Branding ${props.branding?.name} for ${props.branding?.domain} was updated` });
            browserHistory.push("/branding/edit");
        },
        onError: e => toast({ className: toastStyles.error, title: "Failed to update branding", description: e.message })
    });
    const createBranding = useCreateReaderBranding({
        onSuccess: (_, props) => {
            toast({ className: toastStyles.info, title: "Branding created", description: `Branding ${props.branding?.name} for ${props.branding?.domain} was created` });
            browserHistory.push("/branding/edit");
        },
        onError: e => toast({ className: toastStyles.error, title: "Failed to create branding", description: e.message })
    });

    return (
        <BrandingEditor
            currentAccount={currentAccount.data}
            currentBranding={currentBranding.data}
            onBrandCreate={(accountId, logoImage, branding) => createBranding.mutate({ accountId, logoImage, branding })}
            onBrandUpdate={(accountId, logoImage, branding) => updateBranding.mutate({ accountId, logoImage, branding })}
        />
    );
}

export const BrandingEdit = DragDropContext(HTML5Backend)(BrandingEditFC);
