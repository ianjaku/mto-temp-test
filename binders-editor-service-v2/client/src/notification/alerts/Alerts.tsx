import * as React from "react";
import {
    Alert,
    AlertChangeType,
    AlertChangedEventBody
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { FC, useEffect, useState } from "react";
import { APIFindActiveAlerts } from "../api";
import InfoBannerItem from "@binders/ui-kit/lib/compounds/banners/infobanneritem";
import { InfoBannerWrapper } from "@binders/ui-kit/lib/compounds/banners/infobannerwrapper";
import { useActiveAccount } from "../../accounts/hooks";

export let alertUpdateListeners: ((body: AlertChangedEventBody) => void)[] = [];

export const Alerts: FC<{ userId: string }> = ({ userId }) => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const account = useActiveAccount();

    useEffect(() => {
        const listener = (body: AlertChangedEventBody) => {
            if (body.changeType === AlertChangeType.DELETED) {
                setAlerts(alerts => alerts.filter(a => a.alertId !== body.changedAlert.alertId));
            }
            if (body.changeType === AlertChangeType.CREATED || body.changeType === AlertChangeType.UPDATED) {
                setAlerts(alerts => {
                    const newAlerts = alerts.filter(a => a.alertId !== body.changedAlert.alertId);
                    return [...newAlerts, body.changedAlert];
                });
            }
        }
        alertUpdateListeners.push(listener);
        return () => {
            alertUpdateListeners = alertUpdateListeners.filter(l => l !== listener);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!account?.id) return;
        // Wait 2 seconds before fetching alerts to not slow down the initial page load
        const timeout = setTimeout(async () => {
            const alerts = await APIFindActiveAlerts(account.id);
            setAlerts(alerts);
        }, 2000);
        return () => clearTimeout(timeout);
    }, [setAlerts, account?.id]);

    const shouldShowButton = (alert: Alert) => {
        return alert.buttonText != null && alert.buttonText !== "" &&
            alert.buttonLink != null && alert.buttonLink !== "";
    }

    if (alerts.length === 0) return null;

    return (
        <InfoBannerWrapper>
            {alerts.map((alert) => (
                <InfoBannerItem
                    key={alert.alertId}
                    name={alert.alertId}
                    text={alert.message}
                    cooldownHours={alert.cooldownHours < 0 ? 1000000 : alert.cooldownHours}
                    viewerIdentifier={userId}
                    hideBefore={alert.startDate}
                    hideAfter={alert.endDate}
                    buttonText={shouldShowButton(alert) ? alert.buttonText : undefined}
                    onButtonClick={() => window.open(alert.buttonLink, "_blank", "noopener")}
                />
            ))}
        </InfoBannerWrapper>
    )
}
