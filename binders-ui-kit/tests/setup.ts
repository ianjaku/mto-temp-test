/* eslint-disable @typescript-eslint/no-explicit-any */
// Get rid of the react warning so we don't clutter test run results
(<any> global).requestAnimationFrame = (callback) => {
    setTimeout(callback, 0);
};


// Setup jsdom
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { JSDOM } from "jsdom";

const jsdom = new JSDOM("<!doctype html><html><body></body></html>");
const { window } = jsdom;

function copyProps(src, target) {
    const props = Object.getOwnPropertyNames(src)
        .filter(prop => typeof target[prop] === "undefined")
        .reduce((result, prop) => ({
            ...result,
            [prop]: Object.getOwnPropertyDescriptor(src, prop),
        }), {});
    Object.defineProperties(target, props);
}

// tslint:disable:no-any
(<any> global).window = window;
(<any> global).document = window.document;
(<any> global).navigator = {
    userAgent: "node.js",
};
// tslint:enable:no-any

copyProps(window, global);


// Configure enzyme
import { configure } from "enzyme";
// eslint-disable-next-line sort-imports
import Adapter from "enzyme-adapter-react-16";

configure({ adapter: new Adapter() });
