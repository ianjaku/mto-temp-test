import * as React from "react";
import * as Routes from "../../routes";
import { APIGetAllAccounts, APIGetLicensing, APIGetMyAccounts } from "../accounts/api";
import { FC, useEffect, useState } from "react";
import { Route, Switch } from "react-router-dom";
import Deploys from "../deploys";
import { NavbarMenuItemType } from "@binders/ui-kit/lib/elements/navbar";
import Performance from "../performance";
import Platform from "../platform";
import ResponsiveLayout from "@binders/ui-kit/lib/elements/ResponsiveLayout";
import SuccessMetrics from "../successMetrics";
import { activateAccountId } from "../documents/api";
import { useQuery } from "@tanstack/react-query";

export const App: FC = () => {
    const accounts = useQuery({ queryFn: APIGetAllAccounts, queryKey: ["dashboard", "all-accounts"] });
    const myAccounts = useQuery({ queryFn: APIGetMyAccounts, queryKey: ["dashboard", "my-accounts"] });
    const licensing = useQuery({ queryFn: APIGetLicensing, queryKey: ["dashboard", "accounts-licensing"] });
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

    function getNavbarElements() {
        return [
            {
                label: "Metrics",
                link: Routes.SUCCESS_METRICS,
                type: NavbarMenuItemType.pieChart,
            },
            {
                label: "Platform",
                link: Routes.PLATFORM,
                type: NavbarMenuItemType.advanced,
            },
            {
                label: "Performance",
                link: Routes.PERFORMANCE,
                type: NavbarMenuItemType.performance
            }
        ];
    }

    useEffect(() => {
        const [firstAccount] = myAccounts.data || [];
        if (firstAccount) {
            activateAccountId(firstAccount.id);
        }
    }, [myAccounts]);

    if (myAccounts.isError || accounts.isError || licensing.isError) {
        return <div>Failure</div>;
    }

    if (myAccounts.isLoading || accounts.isLoading || licensing.isLoading) {
        return null;
    }

    return (
        <ResponsiveLayout
            bottomItems={[]}
            items={getNavbarElements()}
            isMobileDrawerOpen={isMobileDrawerOpen}
            setIsMobileDrawerOpen={setIsMobileDrawerOpen}
        >
            <div className="main-container">
                <Switch>
                    <Route
                        path={Routes.SUCCESS_METRICS}
                        component={() => <SuccessMetrics accounts={accounts.data} />}
                    />
                    <Route
                        path={Routes.DEPLOYS}
                        component={() => <Deploys />}
                    />
                    <Route
                        path={Routes.PLATFORM}
                        component={() => <Platform accounts={accounts.data} licensing={licensing.data} />}
                    />
                    <Route
                        path={Routes.PERFORMANCE}
                        component={() => <Performance />}
                    />
                </Switch>
            </div>
        </ResponsiveLayout>
    );
}

export default App;
