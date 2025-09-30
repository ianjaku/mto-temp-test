import { IBreadcrumbItem } from "../../../src/elements/breadcrumbs";

export default class BreadcrumbItem implements IBreadcrumbItem {

    public name: string;
    public link: string;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(name, link = "") {
        this.name = name;
        this.link = link;
    }
}
