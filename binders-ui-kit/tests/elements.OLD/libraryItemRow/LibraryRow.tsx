import * as React from "react";
import LibraryRow, { ILibraryRowAction, ItemType } from "../../../src/elements/libraryItem/row";
import MuiThemeProvider from "@material-ui/core/styles/MuiThemeProvider";
import { create } from "react-test-renderer";
import { mount } from "enzyme";

const THUMBNAIL = {
    bgColor: "white",
    buildRenderUrl: () => "https://dummyimage.com/100x100",
    fitBehaviour: "fit",
    medium: "https://dummyimage.com/100x100",
};

const TITLE = "a document";
const WIDTH = "600px";

let clickedRow = false;

const actions: ILibraryRowAction[] = [
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

const createLibraryRow = () => wrapWithTheme(<LibraryRow title={TITLE} thumbnail={THUMBNAIL}/>);
const createLibraryRowFixedWidth = () => wrapWithTheme(<LibraryRow title={TITLE} thumbnail={THUMBNAIL} width={WIDTH}/>);
const createLibraryRowWithActions = () => wrapWithTheme(<LibraryRow title={TITLE} thumbnail={THUMBNAIL} libraryRowActions={actions}/>);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createLibraryFolderRow = () => wrapWithTheme(<LibraryRow title={TITLE} thumbnail={THUMBNAIL} type={ItemType.COLLECTION} onClick={() => clickedRow = true }/>);

// snapshots
test("Library row (snapshot)", () => {
    const lr = create(createLibraryRow());
    const serialized = lr.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("Library row fixed width (snapshot)", () => {
    const lr = create(createLibraryRowFixedWidth());
    const serialized = lr.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("Library row with actions (snapshot)", () => {
    const lr = create(createLibraryRowWithActions());
    const serialized = lr.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("Library folder row (snapshot)", () => {
    const lr = create(createLibraryFolderRow());
    const serialized = lr.toJSON();
    expect(serialized).toMatchSnapshot();
});

// enzyme
test("Library row (mount: enzyme+jsdom)", () => {
    const fmMount = mount(createLibraryRow());
    const thumbnail = fmMount.find(".thumbnail").first();
    const title = fmMount.find(".library-row-title-label").first().text();
    expect(thumbnail.props().src).toEqual(THUMBNAIL);
    expect(title).toEqual(TITLE);
});

test("Library row fixed width (mount: enzyme+jsdom)", () => {
    const fmMount = mount(createLibraryRowFixedWidth());
    const row = fmMount.find(".library-row").first();
    expect(row.props().style.width).toEqual(WIDTH);
});

test("Library row with actions (mount: enzyme+jsdom)", () => {
    const fmMount = mount(createLibraryRowWithActions());
    const contextMenuIcon = fmMount.find(".context-menu").first();
    expect(contextMenuIcon).toHaveLength(1);
});
