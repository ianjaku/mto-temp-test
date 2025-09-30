import { ChecklistProgressLocator } from "./checklistprogresslocators";
import { TestSection } from "../../../testsection";
import { expect } from "@playwright/test";

export class ChecklistProgress extends TestSection {

    private readonly locator = new ChecklistProgressLocator(this.context);

    /**
     * Checks against all rows in the checklist table.
     * 
     * Expects rows[0] to be the first row of the checklist progress table,
     * rows[1] to be the seconds, ...
     */
    async expectRows(
        rows: { percentage: number; step: number; }[]
    ): Promise<void> {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            await expect(this.locator.completionColumn(i, `${row.percentage}%`)).toBeVisible();
            await expect(this.locator.stepColumn(i, row.step.toString())).toBeVisible();
        }
    }
    
}
