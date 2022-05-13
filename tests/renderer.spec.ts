import { expect } from "chai";
import { before, describe, it } from "mocha";

import * as path from "path";
import * as fs from "fs/promises";
import * as puppeteer from "puppeteer";

// Rendering can take awhile (especially if we have to load the browser context),
//  so increase timeout to 4 seconds
const TIMEOUT = 4000;

// Whether to run browser context in headless mode,
//  this should only be set to `false` for debug purposes
const HEADLESS = false;

// Test html page with a div to render the graph into
const TEST_PAGE = `<!DOCTYPE html><html><body><div id="desmos-graph"></div></body></html>`;

class RendererTester {
    private readonly browser: puppeteer.Browser;

    private constructor(browser: puppeteer.Browser) {
        this.browser = browser;
    }

    public static async create(): Promise<RendererTester> {
        const browser = await puppeteer.launch({ headless: HEADLESS });
        return new RendererTester(browser);
    }

    /** Render a graph, returns the relevant svg string */
    public async render(source: string): Promise<string> {
        const page = await this.browser.newPage();

        // The web-crypto api requires a 'secure context',
        //      this means we can't simply inject the page content into a new tab
        // Opening an empty file url appears to fix the issue
        // await page.goto("file:///"); // only works on linux
        await page.goto("file:///C:"); // only works on windows

        // Set our test page content
        page.setContent(TEST_PAGE);

        // Load stubs
        const stub = await fs.readFile(path.join(__dirname, "stub.js"), { encoding: "utf-8" });

        // Load plugin
        const plugin = await fs.readFile(path.join(__dirname, "..", "main.js"), { encoding: "utf-8" });

        // Inject plugin script and type stubs
        page.addScriptTag({ content: stub });
        page.addScriptTag({ content: plugin });

        // <-- Plugin is now available at module.exports -->

        const svg = await page.evaluate((source) => {
            return new Promise((resolve) => {
                // Create plugin instance
                const plugin = new module.exports();

                // Init plugin
                plugin.onload().then(() => {
                    // Fetch codeblock
                    const proc = plugin.getCodeBlockProcessor("desmos-graph");

                    // Render graph
                    proc(source, document.getElementById("desmos-graph")).then(() => {
                        const svg = document.getElementById("desmos-graph")?.innerHTML;
                        resolve(svg);
                    });
                });
            });
        }, source);

        return svg as string;
    }

    public async dispose(): Promise<void> {
        await this.browser.close();
    }
}

describe("renderer", function () {
    this.timeout(TIMEOUT);
    this.slow(TIMEOUT / 2);
    let framework: RendererTester;

    before(async () => {
        framework = await RendererTester.create();
    });

    after(async () => {
        await framework.dispose();
    });

    it("works", async () => {
        const svg = await framework.render("y=x");
        console.log(svg);
    });
});
