import * as React from "react";
import Navbar, { INavbarMenuItem, NavbarMenuItemType } from "../../../src/elements/navbar";
import { BrowserRouter } from "react-router-dom";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const NAVBAR_MENUITEM1 = { label: "menu item 1", link: "/", type: NavbarMenuItemType.dashboard } as INavbarMenuItem;
const NAVBAR_MENUITEM2 = { label: "menu item 2", link: "/users", type: NavbarMenuItemType.create } as INavbarMenuItem;
const NAVBAR_MENUITEMS = [ NAVBAR_MENUITEM1, NAVBAR_MENUITEM2 ];

const getMenuItems = () => NAVBAR_MENUITEMS;
let activeMenuItem;

const activateMenuItem = (type) => { activeMenuItem = type; };

const THUMBNAIL = {
    bgColor: "#ffffff",
    buildRenderUrl: () => Function.prototype(),
    fitBehaviour: "crop",
    medium: "https://dummyimage.com/400/400/fff",
};

const createDefaultNavbar = () => wrapWithTheme(
    <section>
        <BrowserRouter>
            <Navbar
                items={getMenuItems()}
                headerImage={THUMBNAIL}
                preselectedType={NavbarMenuItemType.create}
                activateMenuItem={activateMenuItem}
            />
        </BrowserRouter>
    </section>
);

// snapshots
test("Navbar (snapshot)", () => {
    const navbar =  create(createDefaultNavbar());
    const serialized = navbar.toJSON();
    expect(serialized).toMatchSnapshot();
});

// enzyme
test("Navbar (mount: enzyme+jsdom)", () => {
    const ddMount = mount(createDefaultNavbar());
    const navList = ddMount.find(".navbar-main-navigation-list").first();
    expect(navList.find("li")).toHaveLength(NAVBAR_MENUITEMS.length);
    const firstItem = navList.find("li").at(0);
    const secondItem = navList.find("li").at(1);
    expect(secondItem.find(".navbar-main-navigation-list-item-label").first().text()).toEqual(NAVBAR_MENUITEM2.label);

    expect(firstItem.hasClass("active")).toEqual(false);
    expect(secondItem.hasClass("active")).toEqual(true);
    expect(activeMenuItem).toEqual(undefined);

    firstItem.simulate("click");

    expect(ddMount.find(".navbar-main-navigation-list li").at(0).hasClass("active")).toEqual(true);
    expect(ddMount.find(".navbar-main-navigation-list li").at(1).hasClass("active")).toEqual(false);
    expect(activeMenuItem).toEqual(NAVBAR_MENUITEM1.type);
});
