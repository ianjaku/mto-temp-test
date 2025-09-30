import * as React from "react";
import Breadcrumbs from "../../../src/elements/breadcrumbs";
import { MemoryRouter } from "react-router";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

let exampleValue = 100;
const onClick = () => exampleValue++;

const items = [
    {
        link: "/",
        name: "Home",
    },
    {
        link: "/lib",
        name: "My Library",
    },
    {
        link: "/colA",
        name: "Collection A",
    },
    {
        link: "/manB",
        name: "Manual B",
    },
];


const wrapWithThemeAndRouter = (crumbs) => (
    wrapWithTheme(<MemoryRouter>{crumbs}</MemoryRouter>)
);

const breadcrumbsWithOnClicks = () =>
    wrapWithThemeAndRouter(<Breadcrumbs items={items} onClick={onClick} />);
const normalBreadcrumbs = () => wrapWithThemeAndRouter(<Breadcrumbs items={items} />);
const singleBreadcrumb = () => wrapWithThemeAndRouter(<Breadcrumbs items={[items[0]]} />);

describe("Breadcrumbs", () => {
    beforeEach(() => {
        exampleValue = 100;
    });
    test("normal breadcrumbs (snapshot)", () => {
        const modal = create(normalBreadcrumbs());
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("single breadcrumb (snapshot)", () => {
        const modal = create(singleBreadcrumb());
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("breadcrumbs with onclicks (snapshot)", () => {
        const modal = create(breadcrumbsWithOnClicks());
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Breadcrumb single (mount: enzyme+jsdom)", () => {
        const element = mount(singleBreadcrumb()).find(".breadcrumbs-item");
        expect(element.length).toEqual(1);
    });

    test("Breadcrumb 4 items (mount: enzyme+jsdom)", () => {
        const element = mount(normalBreadcrumbs()).find("button");
        expect(element.length).toEqual(3);
    });

    test("Last one should be the active one", () => {
        const element = mount(normalBreadcrumbs()).find(".breadcrumbs-item");
        expect(element.at(9).hasClass("breadcrumbs-item--active")).toEqual(true);
    });

    test("Breadcrumbs with onClicks (shallow: enzyme+jsdom)", () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const button = mount(breadcrumbsWithOnClicks())
            .find(".breadcrumbs-item-link")
            .at(0)
            .simulate("click");
        expect(exampleValue).toEqual(101);
    });

    test("Breadcrumbs without onClicks (shallow: enzyme+jsdom)", () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const button = mount(normalBreadcrumbs())
            .find(".breadcrumbs-item-link")
            .at(0)
            .simulate("click");
        expect(exampleValue).toEqual(100);
    });
});
