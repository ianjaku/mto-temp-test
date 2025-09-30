import * as React from "react";
import FontAwesome from "react-fontawesome";
import { RouterState } from "react-router";
import { cn } from "../cn";

export const NavbarElement = (props: { router: RouterState; triple: [string, string, string] }) => {
    const { router, triple } = props;
    const goTo = (pathname: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (router as any).push({ pathname });
    }
    const [to, label, icon] = triple;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isActive = (router as any).isActive(to);
    return (
        <div className={cn(
            "flex flex-row items-center",
            "gap-4 px-4 py-2",
            "text-white text-md font-bold",
            "whitespace-nowrap",
            "cursor-pointer transition-colors",
            isActive ?
                "bg-accent-muted text-foreground rounded-sm hover:text-black" :
                "text-background hover:text-accent hover:bg-foreground",
        )} onClick={() => goTo(to)}>
            <div className="w-3 h-3 flex item-center justify-center">
                <FontAwesome name={icon} />
            </div>
            {label}
        </div>
    );
}

