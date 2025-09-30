import * as React from "react";
import Thumbnail, { FitBehaviour } from "../../../src/elements/thumbnail";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const IMG_LANDSCAPE = "https://dummyimage.com/800x600";
const IMG_PORTRAIT = "https://dummyimage.com/600x800";

const enum Orientation {
    LANDSCAPE,
    PORTRAIT,
}

let selected = false;
let deleted = false;

const selectThumbnail = () => {
    selected = true;
};

const thumbnailOnDelete = () => {
    deleted = true;
};

const createThumbnail = (fitBehaviour: FitBehaviour, orientation: Orientation) => wrapWithTheme(
    <Thumbnail
        fitBehaviour={fitBehaviour}
        bgColor="#eeeeee"
        src={orientation === Orientation.LANDSCAPE ? IMG_LANDSCAPE : IMG_PORTRAIT} />,
);
const createInteractiveThumbnail = () => wrapWithTheme(
    <Thumbnail
        src={IMG_LANDSCAPE}
        onClick={selectThumbnail}
        isSelectable={true}
        isDeletable={true}
        onDelete={thumbnailOnDelete} />,
);

// snapshots
test("Fit landscape thumbnail (snapshot)", () => {
    const imgFitLandscape = create(createThumbnail(FitBehaviour.FIT, Orientation.LANDSCAPE));
    const serialized = imgFitLandscape.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("Fit portrait thumbnail (snapshot)", () => {
    const imgFitPortrait = create(createThumbnail(FitBehaviour.FIT, Orientation.LANDSCAPE));
    const serialized = imgFitPortrait.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("Crop landscape thumbnail (snapshot)", () => {
    const imgCropLandscape = create(createThumbnail(FitBehaviour.CROP, Orientation.PORTRAIT));
    const serialized = imgCropLandscape.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("Crop portrait thumbnail (snapshot)", () => {
    const imgCropPortrait = create(createThumbnail(FitBehaviour.CROP, Orientation.PORTRAIT));
    const serialized = imgCropPortrait.toJSON();
    expect(serialized).toMatchSnapshot();
});

// enzyme
test("Select thumbnail (mount: enzyme+jsdom)", () => {
    const imgMount = mount(createInteractiveThumbnail());
    expect(selected).toEqual(false);
    imgMount
        .find(".thumbnail-wrapper")
        .first()
        .simulate("click");
    expect(selected).toEqual(true);
});

test("Delete thumbnail (mount: enzyme+jsdom)", () => {
    const imgMount = mount(createInteractiveThumbnail());
    expect(deleted).toEqual(false);
    imgMount
        .find(".thumbnail-wrapper")
        .simulate("mouseEnter");

    imgMount
        .find(".thumbnail-outer-wrapper .material-icons")
        .first()
        .simulate("click");

    expect(deleted).toEqual(true);
});
