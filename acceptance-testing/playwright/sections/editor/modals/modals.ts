import { ChecklistProgress } from "./checklistprogress/checklistprogress";
import { ChunkApproval } from "./chunkApproval/chunkApproval";
import { DocumentOwnership } from "./documentOwnership";
import { NotificationSettings } from "./notificationSettings/notificationSettings";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class Modals extends TestSection {

    get checklistProgress(): ChecklistProgress {
        return new ChecklistProgress(this.context);
    }

    get notificationSettings(): NotificationSettings {
        return new NotificationSettings(this.context);
    }

    get chunkApproval(): ChunkApproval {
        return new ChunkApproval(this.context);
    }

    get documentOwnership(): DocumentOwnership {
        return new DocumentOwnership(this.context);
    }

    async clickOk(): Promise<void> {
        await this.clickButton("OK");
    }

    async clickButton(text: string): Promise<void> {
        await this.sharedLocators.getButtonInModal(text).click();
    }

    async waitForModalTitle(title: string): Promise<void> {
        const titleElement = await this.sharedLocators.getModalTitle();
        await expect(titleElement).toContainText(title);
    }

    async waitForModalToClose(): Promise<void> {
        await this.sharedLocators.getModalTitle().waitFor({ state: "hidden" });
    }
}
