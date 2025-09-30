/* eslint-disable no-console */
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Dropdown from "../../../../src/elements/dropdown";

const elements = [
    {
        id: 0,
        label: "element 0",
    },
    {
        id: 1,
        label: "element 1",
    }
];

describe("Dropdown Component", () => {
    it("should allow elements selection", async () => {
        const onSelect = jest.fn();
        render(
            <Dropdown
                type="elements"
                elements={elements}
                onSelectElement={onSelect}
            />
        );
        const dropdown = await screen.findByText("elements");
        fireEvent.mouseDown(dropdown);
        const element1 = await screen.findByText("element 1");
        fireEvent.mouseDown(element1);
        expect(onSelect).toHaveBeenCalledWith(elements[1].id);
    });
    it("should be able to handle `undefined` elements", async () => {
        render(
            <Dropdown
                type="elements"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                elements={undefined as any}
                onSelectElement={() => { /**/ }}
            />
        );
        const el = await screen.findByText("elements");
        expect(el).toBeInTheDocument();
    });
});