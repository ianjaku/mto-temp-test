import { Breadcrumbs } from "./breadcrumbs/breadcrumbs";
import { CookieBanner } from "../shared/cookiebanner/cookiebanner";
import { Document } from "./document/document";
import { Errors } from "./errors/errors";
import { FlashMessage } from "./flashMessage/FlashMessage";
import { Invite } from "./invite/invite";
import { Login } from "./login/login";
import { ReaderModals } from "./modals/modals";
import { RegisterPage } from "./registerPage/registerPage";
import { ResetPassword } from "./resetPassword/resetPassword";
import { Ribbons } from "./ribbons/ribbons";
import { SignUp } from "./signup/signup";
import { StoryBrowser } from "./storybrowser/storybrowser";
import { TestContext } from "../testcontext";
import { TitleChunk } from "./titleChunk";
import { TopBar } from "./topbar/topbar";

export class ReaderSections {

    constructor(
        private readonly context: TestContext
    ) { }

    public async refresh(): Promise<void> {
        await this.context.page.reload({ waitUntil: "domcontentloaded" });
    }

    get breadcrumbs(): Breadcrumbs {
        return new Breadcrumbs(this.context);
    }

    get browser(): StoryBrowser {
        return new StoryBrowser(this.context);
    }

    get cookieBanner(): CookieBanner {
        return new CookieBanner(this.context);
    }

    get document(): Document {
        return new Document(this.context);
    }

    get errors(): Errors {
        return new Errors(this.context);
    }

    get flashMessage(): FlashMessage {
        return new FlashMessage(this.context);
    }

    get invite(): Invite {
        return new Invite(this.context);
    }

    get login(): Login {
        return new Login(this.context);
    }

    get modals(): ReaderModals {
        return new ReaderModals(this.context);
    }

    get readerUrl(): string {
        return this.context.readerUrl;
    }

    get registerPage(): RegisterPage {
        return new RegisterPage(this.context);
    }

    get resetPassword(): ResetPassword {
        return new ResetPassword(this.context);
    }

    get ribbons(): Ribbons {
        return new Ribbons(this.context);
    }

    get signUp(): SignUp {
        return new SignUp(this.context);
    }

    get titleChunk(): TitleChunk {
        return new TitleChunk(this.context);
    }

    get topBar(): TopBar {
        return new TopBar(this.context);
    }
}
