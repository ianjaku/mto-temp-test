import { DocumentAnalyticsLocators } from "./documentanalyticslocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";


export class DocumentAnalytics extends TestSection {

    private readonly locators = new DocumentAnalyticsLocators(this.context);

    async expectPieChartLegendElement(langguageCode: string, views: number): Promise<void> {
        const legendText = await this.locators.getPieChartLegendElement(langguageCode, views).textContent()
        await expect(legendText).toEqual(`${langguageCode.toUpperCase()} : ${views.toString()} view`)
    }
}
