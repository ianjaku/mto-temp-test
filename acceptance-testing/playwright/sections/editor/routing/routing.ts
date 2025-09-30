import { TestSection } from "../../testsection";

export class Routing extends TestSection {

    async toUserSettings(): Promise<void> {
        await this.page.goto(this.editorUrl + "/users");
    }

}
