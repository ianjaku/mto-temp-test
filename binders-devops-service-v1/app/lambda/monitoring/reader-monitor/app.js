/* eslint-disable no-console */
const chromium = require("@sparticuz/chromium");
const { expect } = require("@playwright/test");
const { createCustomMetric } = require("cloudWatchHandler");
const playwright = require("playwright-core");

async function handler(event, context) {
    console.log({ event, context })
    const pageToScrape = "https://test.manual.to"

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
        console.log("Current page url: ", await page.url())
        await page.locator("text=Railways").click()
        console.log("Current page url: ", await page.url())
        await expect(page).toHaveURL("https://test.manual.to/launch/AWqcQn6Qq8z5VhfSNLPG");
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
