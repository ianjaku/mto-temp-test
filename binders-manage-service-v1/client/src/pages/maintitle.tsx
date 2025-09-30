import * as React from "react";
import { Button, ButtonProps } from "../components/button";
import { PageActionsPortal, PageTitlePortal } from "../portals";
import FontAwesome from "react-fontawesome";

export const ContentTitleRow = (props: React.PropsWithChildren<{ title: React.ReactNode; }>) => (
    <>
        <PageTitlePortal>{props.title}</PageTitlePortal>
        <PageActionsPortal>{props.children}</PageActionsPortal>
    </>
);

export const ContentTitleButton = ({ asChild, icon, label, ...props }: ButtonProps & {
    asChild?: boolean;
    icon: string;
    label: string;
}) => {
    if (asChild) {
        return <Button {...props} />
    }
    return <Button {...props}>
        <FontAwesome name={icon} />
        {label}
    </Button>
};

export const ContentTitleAction = ({ handler, icon, label, ...props }: React.PropsWithChildren<ButtonProps & {
    icon: string;
    label: string;
    handler: ButtonProps["onClick"];
}>) => <ContentTitleButton icon={icon} label={label} onClick={handler} {...props} />;

