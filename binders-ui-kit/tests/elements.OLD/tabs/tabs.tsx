import * as React from "react";
import { Pane, Tabs } from "../../../src/elements/tabs";
import { create } from "react-test-renderer";
import { mount } from "enzyme";

const activeTabIndex = 1;

const titles = [
    "Title #1",
    "Title #2",
    "Title #3",
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createTabs = (initialIndex) => (
    <Tabs initialSelectedIndex={activeTabIndex} >
        <Pane label={titles[0]} />
        <Pane label={titles[1]} />
        <Pane label={titles[2]} />
        <Pane label={titles[3]} />
    </Tabs>
);

const createTabsWithoutInitializedActiveIndex = () => (
    <Tabs>
        <Pane label={titles[0]} />
        <Pane label={titles[1]} />
        <Pane label={titles[2]} />
        <Pane label={titles[3]} />
    </Tabs>
);


describe("Tabs", () => {

    test("Base tabs (snapshot)", () => {
        const tabs = create(createTabs(0));
        const serialized = tabs.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Switch tab (mount: enzyme+jsdom)", () => {
        const tabsMount = mount(createTabs(2));
        tabsMount.find(".tabs-nav .tabs-item").first().simulate("click");
        const isActiveTab = tabsMount.find(".tabs-nav .tabs-item").first();
        expect(isActiveTab.hasClass("active")).toEqual(true);
    });

    test("Tabs without initialized active index (mount: enzyme+jsdom)", () => {
        const tabsMount = mount(createTabsWithoutInitializedActiveIndex());
        const isActiveTab = tabsMount.find(".tabs-nav .tabs-item").first();
        expect(isActiveTab.hasClass("active")).toEqual(true);
    });

    test("Let's check tab content existing (mount: enzyme+jsdom)", () => {
        const tabsMount = mount(createTabs(0));
        tabsMount.find(".tabs-nav .tabs-item").first().simulate("click");
        const isContentTabActive = tabsMount.find(".tabs-content .tabs-pane").first();
        expect(isContentTabActive.hasClass("active")).toEqual(true);
        expect(isContentTabActive).toHaveLength(1);
    });

});
