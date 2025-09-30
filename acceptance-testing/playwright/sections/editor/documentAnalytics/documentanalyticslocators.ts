import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class DocumentAnalyticsLocators extends TestSectionLocators {

    public getPieChartLedged(): Locator {
        return this.page.locator(".piechart-legend")
    }

    public getPieChartLegendElement(languageCode: string, views: number): Locator {
        return this.getPieChartLedged().locator(`text=${languageCode.toUpperCase()} : ${views.toString()} view`)
    }


}
