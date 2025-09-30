import * as React from "react";
import TreeNavigator from "../../../src/elements/treenavigator";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const createTreeNavigatorParentItem = () => {
    return [{ id: "0", name: "Root", kind: "document" }];
};

const createTreeNavigatorItems = () => [
    { id: "1", name: "Item 1", kind: "document"},
    { id: "2", name: "Item 2", kind: "document"},
];

let navigatedTo = "-1";
let selected = "-1";
const onNavigate = (id) => navigatedTo = id.id;
const onSelect = (id) => selected = id;

// tslint:disable-next-line
const createTreeNavigator = () => wrapWithTheme(
    <TreeNavigator
        rootItems={createTreeNavigatorParentItem()}
        parentItems={createTreeNavigatorParentItem()}
        items={createTreeNavigatorItems()}
        onNavigate={onNavigate}
        onSelect={onSelect}
    />,
);

describe("Tree navigator", () => {
    test("Tree navigator (snapshot)", () => {
        const treeNavigator = create(createTreeNavigator());
        expect(treeNavigator).toMatchSnapshot();
    });
});

test("Tree navigator fields (mount: enzyme+jsdom)", () => {
    const treeNavigator = mount(createTreeNavigator());
    const parentRow = treeNavigator.find(".tree-navigator-parent").at(0);
    const row1 = treeNavigator.find(".tree-navigator-row").at(0);
    const row2 = treeNavigator.find(".tree-navigator-row").at(1);
    expect(parentRow.find(".tree-navigator-parent-label").first().text()).toEqual("Root");
    expect(row1.find(".tree-navigator-row-label").first().text()).toEqual("Item 1");
    expect(row2.find(".tree-navigator-row-label").first().text()).toEqual("Item 2");
});

test("Tree navigator select (mount: enzyme+jsdom)", () => {
    const treeNavigator = mount(createTreeNavigator());
    const parentRow = treeNavigator.find(".tree-navigator-parent").at(0);
    const row1 = treeNavigator.find(".tree-navigator-row").at(0);
    parentRow.simulate("click");
    expect(selected).toEqual("0");
    row1.simulate("click");
    expect(selected).toEqual("1");
});

test("Tree navigator navigate (mount: enzyme+jsdom)", () => {
    const treeNavigator = mount(createTreeNavigator());
    const row1 = treeNavigator.find(".tree-navigator-row").at(0);
    row1.find(".tree-navigator-row-enter-icon").first().simulate("click");
    expect(navigatedTo).toEqual("1");
    navigatedTo = "-1";
    row1.simulate("doubleclick");
    expect(navigatedTo).toEqual("1");
});
