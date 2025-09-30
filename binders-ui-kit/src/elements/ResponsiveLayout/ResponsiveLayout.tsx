import * as React from "react";
import Navbar, {
    INavbarMenuItem,
    NavbarDrawer,
    NavbarMenuItemType
} from "../navbar";
import ClientThumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import CssBaseline from "@material-ui/core/CssBaseline";
import Header from "../header";
import Hidden from "@material-ui/core/Hidden";
import { IDropdownElement } from "../dropdown";
import { useOutsideClick } from "@binders/client/lib/react/helpers/useOutsideClick";

export interface IAccountSwitcherLink {
    id: string;
    label: string;
    url: string;
    type?: NavbarMenuItemType;
}

export type AccountSwitcherElement = IDropdownElement & { accountId?: string };

export const ResponsiveLayout: React.FC<{
    activateMenuItem?: (type: NavbarMenuItemType) => void;
    activeAccountId?: string;
    classes: {
        content: string;
        root: string;
        toolbar: string;
    };
    headerElement?: React.ReactElement
    headerImage?: ClientThumbnail;
    headerTailElement?: React.ReactNode;
    helpAccountComponent?: React.ReactElement
    isMobileDrawerOpen?: boolean;
    bottomItems: INavbarMenuItem[];
    items: INavbarMenuItem[];
    setIsMobileDrawerOpen?: (value: boolean) => void;
}> = (props) => {

    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const navRef = useOutsideClick<HTMLElement>((event) => {
        if (props.isMobileDrawerOpen && !buttonRef.current?.contains(event.target as Node)) {
            props.setIsMobileDrawerOpen?.(false);
        }
    });

    return (
        <div className={props.classes.root}>
            <CssBaseline />
            <Hidden smUp={true} implementation="css">
                <Header
                    headerImage={props.headerImage}
                    isOpen={props.isMobileDrawerOpen}
                    onClick={() => props.setIsMobileDrawerOpen?.(!props.isMobileDrawerOpen)}
                    tailElement={props.headerTailElement}
                    ref={buttonRef}
                />
            </Hidden>
            <NavbarDrawer
                className="header-navbar"
                isOpen={props.isMobileDrawerOpen}
                onClose={() => props.setIsMobileDrawerOpen?.(false)}
                ref={navRef}
            >
                <Navbar
                    activateMenuItem={type => props.activateMenuItem?.(type)}
                    bottomItems={props.bottomItems}
                    headerElement={props.headerElement}
                    headerImage={props.headerImage}
                    helpAccountComponent={props.helpAccountComponent}
                    isMobileDrawerOpen={props.isMobileDrawerOpen}
                    items={props.items}
                    setIsMobileDrawerOpen={props.setIsMobileDrawerOpen}
                />
            </NavbarDrawer>
            <main className={props.classes.content}>
                <div className={props.classes.toolbar} />
                {props.children}
            </main>
        </div>
    );
}
