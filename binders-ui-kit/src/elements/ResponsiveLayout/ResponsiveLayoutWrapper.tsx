import * as React from "react";
import { INavbarMenuItem, NavbarMenuItemType } from "../navbar";
import { Theme, createStyles, makeStyles } from "@material-ui/core/styles";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import ClientThumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { HelpAccount } from "./HelpAccount";
import { ResponsiveLayout } from "./ResponsiveLayout";
import cx from "classnames";

interface IResponsiveLayoutProps {
    activateMenuItem?: (type: NavbarMenuItemType) => void;
    classes?: {
        content: string;
        root: string;
        toolbar?: string;
    };
    headerElement?: React.ReactElement;
    headerImage?: ClientThumbnail;
    headerTailElement?: React.ReactNode;
    helpAccount?: Account;
    isMobileDrawerOpen?: boolean;
    bottomItems: INavbarMenuItem[];
    items: INavbarMenuItem[];
    setIsMobileDrawerOpen?: (value: boolean) => void;
}

const useStyles = makeStyles((theme: Theme) => createStyles({
    content: {
        flexGrow: 1,
    },
    root: {
        [theme.breakpoints.up("sm")]: {
            display: "flex",
        },
    },
    toolbar: {
        [theme.breakpoints.down("sm")]: {
            ...theme.mixins.toolbar,
            minHeight: "50px",
        },
        [theme.breakpoints.between("sm", "md")]: {
            minHeight: "0px",
        },
    },
}));

export const ResponsiveLayoutWrapper: React.FC<IResponsiveLayoutProps> = (props) => {
    const { classes: propsClasses } = props;
    const stylesClasses = useStyles();
    const classes = {
        root: cx(propsClasses?.root, stylesClasses?.root),
        content: cx(propsClasses?.content, stylesClasses?.content),
        toolbar: cx(propsClasses?.toolbar, stylesClasses?.toolbar),
    }
    return (
        <ResponsiveLayout
            {...props}
            classes={classes}
            helpAccountComponent={<HelpAccount account={props.helpAccount} />}
        />
    );
};

