import { BackendTrackingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { TestCase } from "../fixtures";
import { pollForEvents } from "../helpers/events";
import { waitForEvents } from "../../shared/api/tracking";


const config = BindersConfig.get();

export class DocumentAnalytics extends TestCase {
    private testUser = this.testData.credentials.noAdminUsers[0];
    private englishTitle = "ML TEST DOCUMENT"
    private frenchTitle = "le ML TEST DOCUMENT"
    private dutchTitle = "de ML TEST DOCUMENT"

    async run(): Promise<void> {
        const readerWindow = await this.createBrowserWindow();
        const reader = await readerWindow.openReader({
            credentials: { login: this.testUser.login, password: this.testUser.password },
            queryParams: { domain: this.testData.seedData.domain }
        });

        const { accountId } = this.testData.seedData;

        await waitForEvents(60_000, accountId, EventType.COLLECTION_OPENED, 1);

        await reader.browser.openStoryByTitle(this.englishTitle);
        await reader.document.goToNextChunk();
        await reader.document.goToNextChunk();
        await reader.document.clickUpButton();
        await waitForEvents(60_000, accountId, EventType.DOCUMENT_OPENED, 1);

        await reader.browser.changeLanguage("fr")
        await reader.browser.openStoryByTitle(this.frenchTitle);
        await reader.document.goToNextChunk();
        await reader.document.goToNextChunk();
        await reader.document.clickUpButton();
        await waitForEvents(60_000, accountId, EventType.DOCUMENT_OPENED, 2);

        await reader.browser.changeLanguage("nl")
        await reader.browser.openStoryByTitle(this.dutchTitle);
        await reader.document.goToNextChunk();
        await reader.document.goToNextChunk();
        await reader.document.clickUpButton();
        await waitForEvents(60_000, accountId, EventType.DOCUMENT_OPENED, 3);

        // aggregate user events
        await this.aggregateUserEvents()

        // navigate back to base doc
        const window = await this.createBrowserWindow();
        const editor = await window.openEditorAndLogin();
        // verify number of views
        await editor.browse.expectNumberOfViews(3, this.englishTitle)

        // verify pie chart
        await editor.browse.clickItemContextMenu(this.englishTitle);
        await editor.browse.clickItemInContextMenu("Analytics");
        await editor.documentAnalytics.expectPieChartLegendElement("fr", 1)
        await editor.documentAnalytics.expectPieChartLegendElement("nl", 1)
        await editor.documentAnalytics.expectPieChartLegendElement("en", 1)
    }

    private async aggregateUserEvents() {
        const client = await BackendTrackingServiceClient.fromConfig(
            config,
            "acceptance-testing-analytics-test")
        const accountId = this.testData.seedData.accountId;
        const options = {
            maxAttempts: 25,
            initialDelay: 1000,
            eventType: EventType.DOCUMENT_CLOSED,
            eventCount: 3
        }
        await pollForEvents(client, accountId, options)
        await client.aggregateUserEvents([accountId]);
    }
}

