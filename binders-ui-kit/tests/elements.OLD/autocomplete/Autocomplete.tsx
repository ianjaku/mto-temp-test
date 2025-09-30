import * as React from "react";
import Autocomplete, { IAutocompleteItem } from "../../../src/elements/autocomplete";
import { create } from "react-test-renderer";
import wrapWithTheme from "../../themeHelper";

const data: IAutocompleteItem[] = [
    {
        id: "0",
        label: "joana darek",
        rawLabel: "joana darek",
        value: "joana@manual.to",
    },
    {
        id: "1",
        label: "ann",
        rawLabel: "ann",
        value: "anna@gmail.com",
    },
    {
        id: "2",
        label: "darek chec",
        rawLabel: "darek chec",
        value: "dariusz.chec.ma.dlugiego.maila@gmail.com",
    },
    {
        id: "3",
        label: "darek chec2",
        rawLabel: "darek chec2",
        value: "dariusz.chec3.ma.dlugiego.maila@gmail.com",
    },
    {
        id: "4",
        label: "darek chec23",
        rawLabel: "darek chec23",
        value: "dariusz.chec2.ma.dlugiego.maila@gmail.com",
    },
    {
        id: "5",
        label: "darek chec4",
        rawLabel: "darek chec4",
        value: "dariusz.chec4.ma.dlugiego.maila@gmail.com",
    },
    {
        id: "6",
        label: "darek chec5",
        rawLabel: "darek chec5",
        value: "dariusz.chec5.ma.dlugiego.maila@gmail.com",
    },
    {
        id: "7",
        label: "mam bardzo dlugie imie darek",
        rawLabel: "mam bardzo dlugie imie darek",
        value: "krotki@mail",
    },
];

let exampleValue = 100;
const onClick = () => exampleValue++;
const onClick2 = () => exampleValue--;


function createComponent() {
    return wrapWithTheme(<Autocomplete selectedItems={[]} onDeleteChipClick={onClick2} data={data} onAddNewClick={onClick} />);
}

describe("Button", () => {

    beforeEach(() => {
        exampleValue = 100;
    });


    test("Base Autocomplete (snapshot)", () => {
        const modal = create(createComponent());
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    // todo: tests

    // test("Autocomplete prompts (mount: enzyme+jsdom)", () => {
    //     const elementText = mount(createComponent());
    //     elementText.setState({searchTerm: "darek"});
    //     const promptsLen = elementText.find("li").length;

    //     expect(promptsLen).toEqual(7);
    // });

    // test("Autocomplete onClick (mount: enzyme+jsdom)", () => {
    //     const elementText = mount(createComponent());
    //     elementText.setState({searchTerm: "darek"});
    //     const prompts = elementText.find("li").at(0);
    //     prompts.simulate("click");

    //     expect(exampleValue).toEqual(101);
    // });
});
