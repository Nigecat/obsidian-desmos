import { expect } from "chai";
import { describe, it } from "mocha";

const TEST_PAGE = `
<!DOCTYPE html>
<html>

<head>
</head>

<body> 
    <div id="desmos-graph"></div>
</body>

</html>`;

describe("renderer", () => {
    it("works", async () => {
        const path = await import("path");
        const fs = await import("fs/promises");
        const puppeteer = await import("puppeteer");

        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();

        // Web-crypto api requires a 'secure context',
        //      this means we can't simply inject the page content into a new tab
        // Opening an empty file url appears to fix the issue
        await page.goto("file:///");

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

        page.evaluate(() => {
            // Create plugin instance
            const plugin = new module.exports();

            // Init plugin
            plugin.onload().then(() => {
                // Fetch codeblock
                const proc = plugin.getCodeBlockProcessor("desmos-graph");

                // Render graph
                proc(`y=x`, document.getElementById("desmos-graph")).then(() => {
                    console.log("done!");
                    console.log(document.getElementById("desmos-graph")?.innerHTML);
                });
            });
        });

        // await page.screenshot({ path: "example.png" });
        // await browser.close();
    });
});

// import path from "path";
// import { readFileSync } from "fs";

// const plugin = readFileSync(path.join(__dirname, "main.js"));
// console.log(plugin);

// async function renderGraph(graph: Graph): Promise<void> {
//     console.log(graph, Renderer);
//     return /* todo */;
// }

// describe("renderer", () => {
//     it("works", () => {
//         renderGraph(new Graph([{ equation: "y=x" }], {}));
//     });
// });
