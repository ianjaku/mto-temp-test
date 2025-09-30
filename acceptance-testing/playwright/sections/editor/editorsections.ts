import { AccessModal } from "./accessmodal/accessmodal";
import { AccountAnalytics } from "./accountAnalytics/accountAnalytics";
import { BatchActions } from "./batchactions/batchactions";
import { Breadcrumbs } from "./breadcrumbs/breadcrumbs";
import { Browse } from "./browse/browse";
import { CollectionEditModal } from "./collectioneditmodal/collectioneditmodal";
import { Composer } from "./composer/composer";
import { ContextMenu } from "./contextMenu/contextMenu";
import { CookieBanner } from "../shared/cookiebanner/cookiebanner";
import { DocumentAnalytics } from "./documentAnalytics/documentanalytics";
import { FlashMessage } from "./flashmessage/FlashMessage";
import { Home } from "./home";
import { HubspotWidget } from "../shared/hubspotwidget/hubspotwidget";
import { LeftNavigation } from "./leftnavigation/leftnavigation";
import { Login } from "./login/login";
import { Modals } from "./modals/modals";
import { NewCollectionModal } from "./newcollectionmodal/newcollectionmodal";
import { NewDocumentModal } from "./newdocumentmodal/newdocumentmodal";
import {
    ReaderFeedbackSettingsModal
} from "./readerFeedbackSettingsModal/readerFeedbackSettingsModal";
import { RecycleBin } from "./recyclebin/RecycleBin";
import { ResetPassword } from "./resetPassword/resetPassword";
import { RightPane } from "./rightPane/rightPane";
import { Routing } from "./routing/routing";
import { Search } from "./search/search";
import { Shared } from "./shared/Shared";
import { TestContext } from "../testcontext";
import { TranslocationModal } from "./translocationmodal/translocationmodal";
import { UserSettings } from "./usersettings/usersettings";
import { Users } from "./users/users";

export class EditorSections {

    constructor(
        private readonly context: TestContext
    ) { }

    get accountAnalytics(): AccountAnalytics {
        return new AccountAnalytics(this.context);
    }

    get leftNavigation(): LeftNavigation {
        return new LeftNavigation(this.context);
    }

    get home(): Home {
        return new Home(this.context);
    }

    get browse(): Browse {
        return new Browse(this.context);
    }

    get composer(): Composer {
        return new Composer(this.context);
    }

    get breadcrumbs(): Breadcrumbs {
        return new Breadcrumbs(this.context);
    }

    get rightPane(): RightPane {
        return new RightPane(this.context);
    }

    get login(): Login {
        return new Login(this.context);
    }

    get resetPassword(): ResetPassword {
        return new ResetPassword(this.context);
    }

    get modals(): Modals {
        return new Modals(this.context);
    }

    get usersettings(): UserSettings {
        return new UserSettings(this.context);
    }

    get users(): Users {
        return new Users(this.context);
    }

    get search(): Search {
        return new Search(this.context);
    }

    get routing(): Routing {
        return new Routing(this.context);
    }

    get cookieBanner(): CookieBanner {
        return new CookieBanner(this.context);
    }

    get hubspotWidget(): HubspotWidget {
        return new HubspotWidget(this.context);
    }

    get accessModal(): AccessModal {
        return new AccessModal(this.context);
    }

    get batchActionsModal(): BatchActions {
        return new BatchActions(this.context);
    }

    get readerFeedbackSettingsModal(): ReaderFeedbackSettingsModal {
        return new ReaderFeedbackSettingsModal(this.context);
    }

    get newCollectionModal(): NewCollectionModal {
        return new NewCollectionModal(this.context);
    }

    get newDocumentModal(): NewDocumentModal {
        return new NewDocumentModal(this.context);
    }

    get translocationModal(): TranslocationModal {
        return new TranslocationModal(this.context);
    }

    get collectionEditModal(): CollectionEditModal {
        return new CollectionEditModal(this.context);
    }

    get documentAnalytics(): DocumentAnalytics {
        return new DocumentAnalytics(this.context);
    }

    get flashMessage(): FlashMessage {
        return new FlashMessage(this.context);
    }

    get recycleBin(): RecycleBin {
        return new RecycleBin(this.context);
    }

    get shared(): Shared {
        return new Shared(this.context);
    }

    get contextMenu(): ContextMenu {
        return new ContextMenu(this.context);
    }

}
