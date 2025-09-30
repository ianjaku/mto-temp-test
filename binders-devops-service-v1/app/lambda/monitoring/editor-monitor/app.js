/* eslint-disable no-console */
const chromium = require("@sparticuz/chromium");
const { expect } = require("@playwright/test");
const { getSecret } = require("secretsHandler");
const { createCustomMetric } = require("cloudWatchHandler");
const playwright = require("playwright-core");


async function handler(event, context) {
    console.log({ event, context })
    const pageToScrape = "https://editor.manual.to/login"
    const email = "e2e@manual.to"
    const password = await getSecret(process.env.E2EUserPassword)
    let browser = null;
    let page = null;
    try {
        browser = await playwright.chromium.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
        })
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(pageToScrape);

        await page.locator("[placeholder=\"Email address\"]").click();
        await page.locator("[placeholder=\"Email address\"]").fill(email);
        await page.locator("[placeholder=\"Password\"]").click();
        await page.locator("[placeholder=\"Password\"]").fill(password);
        await page.locator("text=Log in").click();
        await page.locator(".library-row", { has: page.locator("text=E2E test") }).click();
        await expect(page).toHaveURL("https://editor.manual.to/browse/8eFpNo0B0_mULGHFHZkw");
        await page.locator(".library-row", { has: page.locator("text=This is test document") }).click();
        await expect(page).toHaveURL("https://editor.manual.to/documents/8eFpNo0B0_mULGHFHZkw/8uFpNo0B0_mULGHFQpnO");
        await createCustomMetric(0)
    } catch (error) {
        await page?.close()
        await browser?.close()
        console.log(`Error ${error}`);
        await createCustomMetric(1)
        throw error;
    } finally {
        await page?.close()
        await browser?.close()
    }
}
exports.lambdaHandler = handler