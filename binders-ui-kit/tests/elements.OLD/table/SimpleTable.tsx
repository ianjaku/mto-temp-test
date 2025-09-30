/* eslint-disable @typescript-eslint/no-unused-vars */
import * as React from "react";
import SimpleTable from "../../../src/elements/Table/SimpleTable";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const data = [];

for (let i = 1; i < 1001; i++) {
    data.push([`John Doe${i}`, `johndoe${i}@manual.to`, i, <button>Test</button>]);
}

const headers = ["Name", "E-mail", "ID", "actions"];

const table = wrapWithTheme(<SimpleTable data={data} customHeaders={headers} recordsPerPage={5} />);
const tableWithCallbacks = (sortCb, recordsCb, pageChangeCb) => (
    wrapWithTheme(<SimpleTable
        data={data}
        customHeaders={headers}
        onChangeRecordsPerPage={recordsCb}
        onSort={sortCb}
        onPageChange={pageChangeCb}
    />)
);
// most preferred
describe("Table", () => {
    test("Table (snapshot)", () => {
        const modal = create(table);
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    // test last
    test("Should have 1000 elements and 5 per row", () => {
        const element = mount(table);
        let tableElement = element.find("table > tbody > tr");
        expect(tableElement.length).toEqual(5);

        element
            .find(".pagination > li")
            .at(8)
            .simulate("click");
        expect(
            element
                .find(".pagination > li")
                .at(6)
                .text(),
        ).toEqual("200");
        tableElement = element.find("table > tbody > tr");
        expect(tableElement.length).toEqual(5);
    });

    test("Sorting (ASC)", () => {
        const element = mount(table);
        const tableElement = element.find("table > tbody > tr");
        let intField = element
            .find("table > tbody > tr")
            .at(0)
            .find("td")
            .at(2)
            .text();
        let sortIntFieldElement = element.find("table > thead > tr th").at(2);

        // not sorted
        expect(intField).toEqual("1");
        expect(sortIntFieldElement.text().trim()).toEqual("ID");

        // sort ASC
        sortIntFieldElement.simulate("click");
        intField = element
            .find("table > tbody > tr")
            .at(0)
            .find("td")
            .at(2)
            .text();
        sortIntFieldElement = element.find("table > thead > tr th").at(2);
        expect(intField).toEqual("1");
        expect(sortIntFieldElement.text()).toEqual("IDarrow_upward");

        // next 3 pages should also be in downward trend
        const nextButton = element.find(".pagination > li").at(7);
        nextButton.simulate("click");
        nextButton.simulate("click");
        nextButton.simulate("click");
        intField = element
            .find("table > tbody > tr")
            .at(0)
            .find("td")
            .at(2)
            .text();
        const intField2 = element
            .find("table > tbody > tr")
            .at(1)
            .find("td")
            .at(2)
            .text();
        const intField3 = element
            .find("table > tbody > tr")
            .at(2)
            .find("td")
            .at(2)
            .text();

        expect(parseInt(intField, 10)).toBeLessThanOrEqual(parseInt(intField2, 10));
        expect(parseInt(intField2, 10)).toBeLessThanOrEqual(parseInt(intField3, 10));
    });

    test("Sorting (DESC)", () => {
        const element = mount(table);
        const tableElement = element.find("table > tbody > tr");
        let intField = element
            .find("table > tbody > tr")
            .at(0)
            .find("td")
            .at(2)
            .text();
        let sortIntFieldElement = element.find("table > thead > tr th").at(2);

        // not sorted
        expect(intField).toEqual("1");
        expect(sortIntFieldElement.text().trim()).toEqual("ID");

        // sort DESC
        sortIntFieldElement.simulate("click");
        sortIntFieldElement.simulate("click");
        intField = element
            .find("table > tbody > tr")
            .at(0)
            .find("td")
            .at(2)
            .text();
        sortIntFieldElement = element.find("table > thead > tr th").at(2);
        expect(intField).toEqual("1000");
        expect(sortIntFieldElement.text()).toEqual("IDarrow_downward");

        // next 3 pages should also be in downward trend
        const nextButton = element.find(".pagination > li").at(7);
        nextButton.simulate("click");
        nextButton.simulate("click");
        nextButton.simulate("click");
        intField = element
            .find("table > tbody > tr")
            .at(0)
            .find("td")
            .at(2)
            .text();
        const intField2 = element
            .find("table > tbody > tr")
            .at(1)
            .find("td")
            .at(2)
            .text();
        const intField3 = element
            .find("table > tbody > tr")
            .at(2)
            .find("td")
            .at(2)
            .text();

        expect(parseInt(intField, 10)).toBeGreaterThanOrEqual(parseInt(intField2, 10));
        expect(parseInt(intField2, 10)).toBeGreaterThanOrEqual(parseInt(intField3, 10));
    });

    test("Callbacks", () => {
        const cbSort = jest.fn();
        const cbPage = jest.fn();
        const cbRecord = jest.fn();

        const element = mount(tableWithCallbacks(cbSort, cbRecord, cbPage));
        let tableElement = element.find("table > tbody > tr");
        expect(tableElement.length).toEqual(10);

        const sortElement = element.find("table > thead > tr > th").at(0);
        const nextPageElement = element.find(".pagination > li").at(7);
        element.find(".table-footer .dropdown-field").simulate("click");

        const showRecordsElement = element.find(".dropdown-elements li").at(2);
        showRecordsElement.simulate("mousedown");
        tableElement = element.find("table > tbody > tr");

        expect(tableElement.length).toEqual(100);
        expect(cbRecord.mock.calls.length).toEqual(1);

        sortElement.simulate("click");
        sortElement.simulate("click");
        sortElement.simulate("click");
        expect(cbSort.mock.calls.length).toEqual(3);

        nextPageElement.simulate("click");
        nextPageElement.simulate("click");
        nextPageElement.simulate("click");
        expect(cbPage.mock.calls.length).toEqual(3);
    });
});
