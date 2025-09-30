import * as React from "react";
import ContextMenu from "../../../src/elements/contextmenu";
import MenuItem from "../../../src/elements/contextmenu/MenuItem";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

let exampleValue = 100;
const onClick = () => exampleValue++;


function createMenu(opened = false) {
    return (
        wrapWithTheme(<ContextMenu defaultOpened={opened} menuIconName={"rowing"}>
            <MenuItem onClick={onClick} title="Add document" iconName={"home"} />
            <MenuItem onClick={onClick} title="Edit" iconName={"edit"} />
            <MenuItem onClick={onClick} title="Delete" iconName={"delete"} />
            <MenuItem onClick={onClick} title="Move" iconName={"folder"} />
            <MenuItem onClick={onClick} title="Create instance" iconName={"content_copy"} />
            <MenuItem onClick={onClick} title="Share" iconName={"share"} />
            <MenuItem onClick={onClick} title="Access" iconName={"person"} />
        </ ContextMenu>)
    );

}

function createSimpleMenu() {
    return (
        wrapWithTheme(<ContextMenu defaultOpened={true}>
            <MenuItem onClick={onClick} title="Add document" iconName={"home"} />
            <MenuItem onClick={onClick} title="Edit" iconName={"edit"} />
            <MenuItem onClick={onClick} title="Delete" iconName={"delete"} />
            <MenuItem onClick={onClick} title="Move" iconName={"folder"} />
            <MenuItem onClick={onClick} title="Create instance" iconName={"content_copy"} />
            <MenuItem onClick={onClick} title="Share" iconName={"share"} />
            <MenuItem onClick={onClick} title="Access" iconName={"person"} />
        </ ContextMenu>)
    );

}

describe("Button", () => {

    beforeEach(() => {
        exampleValue = 100;
    });


    test("Base ContextMenu (snapshot)", () => {
        const element = create(createMenu());
        const serialized = element.toJSON();
        expect(serialized).toMatchSnapshot();
    });


    test("Clicking icon (mount: enzyme+jsdom)", () => {
        const element = mount(createMenu());
        element.find("button").first()
            .simulate("click");

        expect(element.find("button").hasClass("contextMenu-icon--active"));

    });

    test("Showing menu (mount: enzyme+jsdom)", () => {
        const element = mount(createSimpleMenu());
        const menu = element.find(".contextMenu");
        expect(menu.exists()).toEqual(true);

    });

    test("Closing menu (mount: enzyme+jsdom)", () => {
        const element = mount(createSimpleMenu());
        const menuItem = element.find(".contextMenu-item-icon.material-icons").at(0);
        menuItem.simulate("mouseDown");
        expect(element.find(".contextMenu-container").exists()).toEqual(false);

    });

    test("Clicking menuItem (mount: enzyme+jsdom)", () => {
        const element = mount(createSimpleMenu());
        const menuItem = element.find(".contextMenu-item-icon.material-icons").at(0);
        menuItem.simulate("mouseDown");
        expect(exampleValue).toEqual(101);

    });
});
