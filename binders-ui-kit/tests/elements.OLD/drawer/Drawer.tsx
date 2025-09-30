import * as React from "react";
import Button from "../../../src/elements/button";
import Drawer from "../../../src/elements/drawer";
import Pane from "../../../src/elements/rightPane";
import PaneItem from "../../../src/elements/rightPane/item";
import SearchInput from "../../../src/elements/input/SearchInput";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

function onClick() {
    alert("button clicked!");
}

function getDrawer() {
    return wrapWithTheme(
        <Pane ribbonsTopHeight={0}>
            <PaneItem iconName={"add"} >
                <Drawer title="Media1">
                    <Button onClick={onClick} text="Horses" secondary={true} />
                </Drawer>
            </PaneItem>
            <PaneItem iconName={"image"} >
                <Drawer title="Media2">
                    <Button onClick={onClick} text="Are" secondary={true} />
                </Drawer>
            </PaneItem>
            <PaneItem iconName={"settings"} >
                <Drawer title="Media3">
                    <Button onClick={onClick} text="Awesome" secondary={true} />
                </Drawer>
            </PaneItem>
            <PaneItem iconName={"share"} >
                <Drawer title="Media4">
                    <SearchInput inverted={true} />
                </Drawer>
            </PaneItem>
        </Pane>,
    );

}
let drawer = null;

describe("Drawer", () => {

    beforeEach(() => {
        drawer = getDrawer();
    });


    test("drawer (snapshot)", () => {
        const modal = create(drawer);
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("click on icon (mount: enzyme+jsdom)", () => {
        const element = mount(drawer);
        element.find("button")
            .at(0).simulate("click");

        const dr = element.find(".drawer.is-opened");
        expect(dr.length).not.toBe(0);
    });

    test("click on icon twice (mount: enzyme+jsdom)", () => {
        const element = mount(drawer);
        element.find("button")
            .at(0).simulate("click");

        element.find("button")
            .at(0).simulate("click");

        const dr = element.find(".drawer.is-opened");
        expect(dr.length).toBe(0);
    });

    test("close drawer by x (mount: enzyme+jsdom)", () => {
        const element = mount(drawer);
        element.find("button")
            .at(0).simulate("click");

        element.find("button.drawer-container-header-icon")
            .at(0).simulate("click");

        const dr = element.find(".drawer.is-opened");
        expect(dr.length).toBe(0);
    });

    test("check if icon is active (mount: enzyme+jsdom)", () => {
        const element = mount(drawer);
        element.find(".rightPane button")
            .at(0).simulate("click");

        const button = element.find(".pane-item-icon").at(0);
        expect(button.hasClass("pane-item-icon--active"));
    });
});
