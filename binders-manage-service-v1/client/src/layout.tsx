import * as React from "react";
import { Header } from "./pages/header";
import { NavbarElement } from "./pages/navigationbar";
import { Toaster } from "./components/toaster";
import { isMobileDevice } from "@binders/client/lib/react/helpers/browserHelper";
import { isProduction } from "@binders/client/lib/util/environment";
import { useState } from "react";

export default function Layout(props: React.PropsWithChildren<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router: any;
}>) {
    const [isMenuOpen, setIsMenuOpen] = useState(!isMobileDevice());
    const { router } = props;
    return (
        <div className="flex flex-col h-screen">
            <Header
                className="sticky z-20 top-0 left-0 right-0 shadow-md border-b-1 border-b-accent-border"
                toggleMenu={() => setIsMenuOpen(prev => !prev)}
            />
            <div className="flex flex-1 flex-row">
                {isMenuOpen ?
                    <nav
                        className="fixed top-0 z-10 md:relative flex flex-col gap-2 p-2 h-auto bg-gray-800"
                    >
                        <NavbarElement router={router} triple={["/customers", "Customers", "building"]} />
                        <NavbarElement router={router} triple={["/accounts", "Accounts", "at"]} />
                        <NavbarElement router={router} triple={["/users", "Users", "users"]} />
                        <NavbarElement router={router} triple={["/branding", "Branding", "paint-brush"]} />
                        <NavbarElement router={router} triple={["/alerts", "Alerts", "info"]} />
                        <NavbarElement router={router} triple={["/plg", "PLG", "spinner"]} />
                        {isProduction() ? null : <NavbarElement router={router} triple={["/dev/emails", "Mocked emails", "cogs"]} />}
                    </nav> :
                    null}
                <div className="page flex w-full flex-col px-3 py-2 md:px-8 md:py-6 gap-2 md:gap-4 bg-background">
                    <div className="page-header flex flex-row items-center justify-between">
                        <h1 id="portal-page-title" className="text-lg" />
                        <div id="portal-page-actions" className="flex flex-row gap-1" />
                    </div>
                    <div className="page-content overflow-auto">
                        {props.children}
                    </div>
                </div>
                <Toaster />
            </div>
        </div>
    );
}

