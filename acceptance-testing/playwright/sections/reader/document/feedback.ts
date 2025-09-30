import { Locator } from "playwright-core";
import { TestSection } from "../../testsection";
import { TestSectionLocators } from "../../editor/testsectionlocators";
import { expect } from "@playwright/test";

export class ReaderFeedback extends TestSection {

    private readonly locators = new ReaderFeedbackLocators(this.context);

    async checkStayAnonymous(): Promise<void> {
        await this.locators.formStayAnonymous.check();
    }

    async clearMessage(): Promise<void> {
        await this.locators.formMessage.fill("");
    }

    async enterMessage(text: string): Promise<void> {
        await this.locators.formMessage.type(text);
    }

    async expectEnabledSubmit(): Promise<void> {
        await expect(this.locators.formSubmit).not.toBeDisabled();
    }

    async expectDisabledSubmit(): Promise<void> {
        await expect(this.locators.formSubmit).toBeDisabled();
    }

    async expectFormVisible(): Promise<void> {
        await expect(this.locators.form).toBeVisible();
    }

    async expectFormHidden(): Promise<void> {
        await expect(this.locators.form).toBeHidden();
    }

    async expectFormRating(rating: number): Promise<void> {
        for (const idx of [...Array(rating).keys()]) {
            const starClasses = await this.locators.formRatingStar(idx + 1).getAttribute("class");
            await expect(starClasses).toContain("__highlighted");
            await expect(starClasses).not.toContain("__disabled");
        }
    }

    async expectExistingFeedbackRating(rating: number): Promise<void> {
        for (const idx of [...Array(rating).keys()]) {
            const starClasses = await this.locators.existingRatingStar(idx + 1).getAttribute("class");
            await expect(starClasses).toContain("__highlighted");
            await expect(starClasses).toContain("__disabled");
        }
    }

    async expectMissingCheckboxStayAnonymous(): Promise<void> {
        await expect(this.locators.formStayAnonymous).toHaveCount(0);
    }

    async expectMissingFeedbackRating(): Promise<void> {
        await expect(this.locators.existingRating).toHaveCount(0);
    }

    async expectExistingFeedbackMessage(text: string): Promise<void> {
        await expect(this.locators.existingMessage).toHaveText(text);
    }

    async expectMissingFeedbackMessage(): Promise<void> {
        await expect(this.locators.existingMessage).toHaveCount(0);
    }

    async selectStar(star: number): Promise<void> {
        await this.locators.formRatingStar(star).click();
    }

    async submitFeedback(): Promise<void> {
        await this.locators.formSubmit.click();
    }

    async changeFeedback(): Promise<void> {
        await this.locators.feedbackUpdate.click();
    }
}

class ReaderFeedbackLocators extends TestSectionLocators {
    existingMessage = this.page.locator(".chunk-feedback-last .message");
    existingRating = this.page.locator(".chunk-feedback-last .rating-stars");
    form = this.page.locator(".chunk-feedback-form");
    formMessage = this.page.locator(".chunk-feedback-message");
    formStayAnonymous = this.page.locator(".chunk-feedback-anonymous");
    formSubmit = this.page.locator(".chunk-feedback-submit");
    feedbackUpdate = this.page.locator(".chunk-feedback-update");

    existingRatingStar(idx: number): Locator {
        return this.page.locator(`.chunk-feedback-last .rating-stars .rating-point:nth-child(${idx}) .rating-point-button`);
    }

    formRatingStar(idx: number): Locator {
        return this.page.locator(`.chunk-feedback-form .rating-stars .rating-point:nth-child(${idx}) .rating-point-button`);
    }
}
