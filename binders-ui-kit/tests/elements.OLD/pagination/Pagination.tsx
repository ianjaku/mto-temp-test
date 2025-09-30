/* eslint-disable @typescript-eslint/no-unused-vars */
import * as React from "react";
import Pagination from "../../../src/elements/pagination";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";


const paginationLongRange = wrapWithTheme(<Pagination max={500} />);
const paginationDisplayPages = wrapWithTheme(<Pagination max={500} displayPages={20} />);

const renderPaginationWithCallback = c => wrapWithTheme(<Pagination max={500} onPageChange={c} />);

// most preferred
describe("Pagination", () => {
    test("Pagination Long range (snapshot)", () => {
        const modal = create(paginationLongRange);
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Pagination Display pages (snapshot)", () => {
        const modal = create(paginationDisplayPages);
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    // test last
    test("Page texts should be correct", () => {
        const element = mount(paginationLongRange);
        const amountFirstPage = element.find(".pagination > li").length;
        const firstPageText = element
            .find(".pagination > li")
            .at(0)
            .text();
        const previousPageText = element
            .find(".pagination > li")
            .at(1)
            .text();
        const page1Text = element
            .find(".pagination > li")
            .at(2)
            .text();
        const page2Text = element
            .find(".pagination > li")
            .at(3)
            .text();
        const pageNextPage = element
            .find(".pagination > li")
            .at(7)
            .text();
        const pageLastPage = element
            .find(".pagination > li")
            .at(8)
            .text();

        expect(amountFirstPage).toEqual(9);
        // todo: fix the names
        // expect(firstPageText).toEqual("keyboard_arrow_leftkeyboard_arrow_leftFirst");
        // expect(previousPageText).toEqual("keyboard_arrow_leftPrevious");
        expect(page1Text).toEqual("1");
        expect(page2Text).toEqual("2");
        // expect(pageNextPage).toEqual("Nextkeyboard_arrow_right");
        // expect(pageLastPage).toEqual("Lastkeyboard_arrow_rightkeyboard_arrow_right");
    });

    // test first and previous
    test("First and Previous should be disabled on page 1", () => {
        const element = mount(paginationLongRange);
        const firstPageAttr = element
            .find(".pagination > li")
            .at(0)
            .hasClass("disabled");
        const previousPageAttr = element
            .find(".pagination > li")
            .at(1)
            .hasClass("disabled");

        expect(firstPageAttr).toEqual(true);
        expect(previousPageAttr).toEqual(true);
    });

    test("First should be disabled and Previous should be visible on page 2", () => {
        const mockCallback = jest.fn();

        const element = mount(renderPaginationWithCallback(mockCallback));
        const page2Element = element.find(".pagination > li").at(3);

        page2Element.simulate("click");
        let firstPageElement = element.find(".pagination > li").at(0);
        let previousPageElement = element.find(".pagination > li").at(1);
        const pageNextElement = element.find(".pagination > li").at(7);

        expect(mockCallback.mock.calls.length).toEqual(1);
        expect(firstPageElement.hasClass("disabled")).toEqual(true);
        expect(previousPageElement.hasClass("disabled")).toEqual(false);

        pageNextElement.simulate("click");
        firstPageElement = element.find(".pagination > li").at(0);
        previousPageElement = element.find(".pagination > li").at(1);
        expect(mockCallback.mock.calls.length).toEqual(2);
        expect(firstPageElement.hasClass("disabled")).toEqual(false);
        expect(previousPageElement.hasClass("disabled")).toEqual(false);
    });

    test("Previous and last should not be visible when on last page", () => {
        const mockCallback = jest.fn();
        const element = mount(renderPaginationWithCallback(mockCallback));

        let pageNextElement = element.find(".pagination > li").at(7);
        let pageLastElement = element.find(".pagination > li").at(8);

        expect(mockCallback.mock.calls.length).toEqual(0);
        expect(pageLastElement.hasClass("disabled")).toEqual(false);
        expect(pageNextElement.hasClass("disabled")).toEqual(false);

        // go to last page
        pageLastElement.simulate("click");
        pageNextElement = element.find(".pagination > li").at(7);
        pageLastElement = element.find(".pagination > li").at(8);

        expect(mockCallback.mock.calls.length).toEqual(1);
        expect(pageLastElement.hasClass("disabled")).toEqual(true);
        expect(pageNextElement.hasClass("disabled")).toEqual(true);

        // go to previous page
        element
            .find(".pagination > li")
            .at(1)
            .simulate("click");
        pageNextElement = element.find(".pagination > li").at(7);
        pageLastElement = element.find(".pagination > li").at(8);

        expect(mockCallback.mock.calls.length).toEqual(2);
        expect(pageLastElement.hasClass("disabled")).toEqual(true);
        expect(pageNextElement.hasClass("disabled")).toEqual(false);

        // go 1 more page back
        element
            .find(".pagination > li")
            .at(1)
            .simulate("click");
        pageNextElement = element.find(".pagination > li").at(7);
        pageLastElement = element.find(".pagination > li").at(8);

        expect(mockCallback.mock.calls.length).toEqual(3);
        expect(pageLastElement.hasClass("disabled")).toEqual(false);
        expect(pageNextElement.hasClass("disabled")).toEqual(false);
    });
});
