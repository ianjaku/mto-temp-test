import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../../components/dialog";
import { toastStyles, useToast } from "../../components/use-toast";
import { Button } from "../../components/button";
import FontAwesome from "react-fontawesome";
import { useLinkManyAccountFeatures } from "../../api/hooks";

export const RECOMMENDED_FEATURES = [
    "account_analytics",
    "analytics",
    "autologout",
    "browser_tab_title",
    "commenting_in_editor",
    "contributor_role",
    "emojis_in_editor",
    "export_publications_as_pdf",
    "interface_i18n",
    "live_translation_on_reader",
    "livechat",
    "machine_translation",
    "manualto_chunk",
    "publication_history_pane",
    "qr_code_logo",
    "read_reports",
    "usergroups_in_useraction_export",
    "video_streaming",
    "document_owner"
]

export const FeaturesPresetDialog = (props: { accountId: string }) => {
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const { toast } = useToast();
    const installFeatures = useLinkManyAccountFeatures({
        onSuccess: (_, { features }) => {
            toast({ className: toastStyles.info, title: "Features updated", description: `${features.length} features were set` })
            setIsDialogOpen(false);
        },
        onError: e => toast({ className: toastStyles.error, title: "Failed to set features", description: e.message })
    })

    return <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}><FontAwesome name="cubes" /> Set Recommended Features</Button>
        </DialogTrigger>
        <DialogContent className="w-full md:w-xl max-w-screen">
            <DialogHeader className="flex flex-col gap-2">
                <DialogTitle>Set recommended features</DialogTitle>
                <DialogDescription>Following features will be enabled</DialogDescription>
            </DialogHeader>
            <ul>
                {RECOMMENDED_FEATURES.map(feat => (
                    <li key={feat}>
                        <strong>{feat}</strong>
                    </li>
                ))}
            </ul>
            <DialogFooter>
                <Button type="submit" onClick={() => installFeatures.mutate({ accountId: props.accountId, features: RECOMMENDED_FEATURES })}>
                    <FontAwesome name="check" /><span>Confirm</span>
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
}

