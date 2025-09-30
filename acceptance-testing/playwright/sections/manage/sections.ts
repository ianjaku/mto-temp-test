import { Accounts } from "./accounts";
import { Brandings } from "./brandings";
import { Login } from "./login";
import { Navbar } from "./navbar";
import { PlgTrial } from "./plg-trial";
import { TestContext } from "../testcontext";
import { Toast } from "./toast";

export class ManageSections {

    constructor(private readonly context: TestContext) { }

    get accounts() {
        return new Accounts(this.context);
    }

    get brandings() {
        return new Brandings(this.context);
    }

    get login() {
        return new Login(this.context);
    }

    get navbar() {
        return new Navbar(this.context);
    }

    get plgTrial() {
        return new PlgTrial(this.context);
    }

    get toast() {
        return new Toast(this.context);
    }

}
