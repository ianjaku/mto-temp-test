import * as React from "react";
import { EnvIndicator } from "./env-indicator";
import FontAwesome from "react-fontawesome";
import { cn } from "../cn";
import { isMobileDevice } from "@binders/client/lib/react/helpers/browserHelper";
import { useWhoAmI } from "../api/hooks";

export const Header = ({ className, toggleMenu }: { className: string; toggleMenu: () => void; }) => {
    const { data: currentUser } = useWhoAmI();
    return (
        <header className={cn(
            "fixedHeader",
            "flex flex-row items-center",
            "px-2 py-2 md:pl-2 md:px-6 gap-2 md:gap-4",
            "bg-accent",
            className,
        )}>
            {isMobileDevice() ?
                <div
                    className="flex items-center justify-center aspect-square cursor-pointer"
                    onClick={toggleMenu}
                ><FontAwesome name="bars" style={{ fontSize: "24px" }} /></div> :
                null}
            <div className="fixedHeaderLogo flex flex-1 flex-row items-center gap-4">
                <img className="max-h-[3rem] max-w-[10ch] md:max-w-[20ch]" src="/assets/logo.png" />
                <EnvIndicator />
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex flex-row items-center ml-2 gap-2">
                    <FontAwesome name="user" />
                    <div className="userWidget-container">
                        <span className="userWidget-container-username" data-private-nocookie>
                            {currentUser?.displayName}
                        </span>
                    </div>
                </div>
            </div>
        </header>
    );
}

