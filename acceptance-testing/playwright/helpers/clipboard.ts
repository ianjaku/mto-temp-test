import { Page } from "@playwright/test";

/**
 * There's not official way to get clipboard content in playwright,
 * this snippet is based on a workaround the maintainers provided
 * (https://github.com/microsoft/playwright/issues/8114)
 */
export async function getClipboardContent(page: Page): Promise<string> {
    // const modifier = isMac ? "Meta" : "Control"; // TODO MT-4730
    const modifier = "Control";
    await page.setContent("<div contenteditable id='tempDiv'></div>");
    await page.focus("div#tempDiv");
    await page.keyboard.press(`${modifier}+KeyV`);
    return await page.evaluate(() => document.querySelector("div#tempDiv").textContent);
}
