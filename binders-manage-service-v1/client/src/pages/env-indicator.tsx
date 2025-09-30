import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./../components/popover";
import { Card } from "./../components/card";
import FontAwesome from "react-fontawesome";
import { cn } from "../cn";
import { isProduction } from "@binders/client/lib/util/environment";

export const EnvIndicator = () => {
    const isProd = isProduction();
    return (
        <Popover modal>
            <PopoverTrigger className="text-left" asChild>
                <Card className={cn(
                    "flex flex-col py-0.5 px-1 rounded-sm cursor-pointer",
                    isProd ? "border-red-700 bg-red-100 text-red-700" : "border-green-700 bg-green-100 text-green-700"
                )}>
                    <span className="flex flex-row items-center gap-2 text-xs">
                        <FontAwesome name={isProd ? "exclamation-triangle" : "check-circle-o"} />
                        <strong>{isProd ? "Production" : "Staging"}</strong>
                    </span>
                </Card>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='start'>
                <Card className={cn(
                    "flex flex-col p-2 rounded-sm",
                    isProd ? "border-red-700 bg-red-100 text-red-700" : "border-green-700 bg-green-100 text-green-700"
                )}>
                    <span className="flex flex-row items-center gap-2">
                        <FontAwesome name={isProd ? "exclamation-triangle" : "check-circle-o"} />
                        <strong>{isProd ? "Production environment" : "Staging environment"}</strong>
                    </span>
                    <p>{isProd ?
                        "This is the live production environment. Take care!" :
                        "This is a staging environment. Feel free to make mistakes."}</p>
                </Card>
            </PopoverContent>
        </Popover>
    )
}
