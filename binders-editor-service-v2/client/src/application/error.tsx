import * as React from "react";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import ClientThumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { FC } from "react";
import ResponsiveLayout from "@binders/ui-kit/lib/elements/ResponsiveLayout";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { TopBar } from "../browsing/MyLibrary/TopBar";
import { useNavbarElements } from "../browsing/HeaderNavbar/HeaderNavbar";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const ErrorFullPage: FC<{
    accountFeatures?: string[];
    activeAccount?: Account;
    headerImage?: ClientThumbnail;
}> = ({
    accountFeatures,
    activeAccount,
    headerImage,
}) => {
    const { t } = useTranslation();
    const { elements: navbarElements, bottomNavbarElements } = useNavbarElements(
        accountFeatures,
        activeAccount,
        false,
        () => { },
    );

    return (
        <div className="error-page flex min-h-screen text-base">
            <ResponsiveLayout
                classes={{ content: "flex grow", root: "grow" }}
                headerImage={headerImage}
                items={navbarElements}
                bottomItems={bottomNavbarElements}
            >
                <div className="myLibrary grow flex flex-col">
                    <TopBar hideAccountSwitcher={true} />
                    <div className="layout flex flex-col grow justify-center items-center gap-2">
                        <h1 className="text-2xl">{t(TK.General_ErrorMaybeOfflineTitle)}</h1>
                        <p>{t(TK.General_ErrorMaybeOfflineSolution)}</p>
                    </div>
                </div>
            </ResponsiveLayout>
        </div>
    );
};
