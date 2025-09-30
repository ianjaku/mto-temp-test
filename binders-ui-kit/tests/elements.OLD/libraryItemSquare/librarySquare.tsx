import * as React from "react";
import LibrarySquare, { ILibraryItemAction } from "../../../src/elements/libraryItem/square";
import { ItemType } from "../../../src/elements/libraryItem/row";
import MuiThemeProvider from "@material-ui/core/styles/MuiThemeProvider";
import { create } from "react-test-renderer";
import { mount } from "enzyme";

const actions: ILibraryItemAction[] = [
    {
        iconName: "edit",
        onClick: undefined,
        title: "action 1",
    },
    {
        iconName: "delete",
        onClick: undefined,
        title: "action 2",
    },
];

function wrapWithTheme(node) {
    return (
        <MuiThemeProvider>{node}</MuiThemeProvider>
    );
}

const createCollectionItem = () => (
    wrapWithTheme(<LibrarySquare title="Universitet Gent" thumbnail="https://dummyimage.com/400x400/cdccca" type={ItemType.COLLECTION} librarySquareActions={actions} />)
);

const createDocumentItem = () => (
    wrapWithTheme(<LibrarySquare title="Universitet Gent" thumbnail="https://dummyimage.com/400x400/cdccca" type={ItemType.DOCUMENT} librarySquareActions={actions} />)
);

describe("My Square Library", () => {

    test("Base Library with single Collection (snapshot)", () => {
        const item = create(createCollectionItem());
        const serialized = item.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Base Library with single Document (snapshot)", () => {
        const item = create(createDocumentItem());
        const serialized = item.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Collection - clicking contextMenu icon (mount: enzyme+jsdom)", () => {
        const item = mount(createCollectionItem());
        item.find(".libraryItem-menu button").first()
            .simulate("click");
        expect(item.find("button").hasClass("contextMenu-icon--active"));
    });

    test("Document - clicking contextMenu icon (mount: enzyme+jsdom)", () => {
        const item = mount(createDocumentItem());
        item.find(".libraryItem-menu button").first()
            .simulate("click");
        expect(item.find("button").hasClass("contextMenu-icon--active"));
    });

    test("Item with correctly (kind) class name (mount: enzyme+jsdom)", () => {
        const item = mount(createCollectionItem());
        const isCollectionClass = item.find(".libraryItem").first();
        expect(isCollectionClass.hasClass("collection")).toEqual(true);
    });

    test("Item with correctly (kind) class name (mount: enzyme+jsdom)", () => {
        const item = mount(createDocumentItem());
        const isDocumentClass = item.find(".libraryItem").first();
        expect(isDocumentClass.hasClass("document")).toEqual(true);
    });

});
