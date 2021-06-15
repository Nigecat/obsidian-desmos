import { Dsl } from "./dsl";
import { Settings } from "./settings";

const CALCULATOR_SETTINGS = {
    settingsMenu: false,
    expressions: false,
    lockViewPort: true,
    zoomButtons: false,
    trace: false,
};

export class Renderer {
    static render(args: Dsl, settings: Settings, el: HTMLElement) {
        const { height, width, equations, hash } = args; // fixme dimensions are ignored with caching enabled

        if (settings.cache) {
            // todo cache the graph
        }

        const expressions = equations.map(
            (equation) =>
                `calculator.setExpression({ latex: "${equation.replace(
                    "\\",
                    "\\\\"
                )}" });`
        );

        // Because of the electron sandboxing we have to do this inside an iframe,
        // otherwise we can't include the desmos API (although it would be nice if they had a REST API of some sort)
        const html_src_head = `<script src="https://www.desmos.com/api/v1.6/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>`;
        const html_src_body = `
            <div id="calculator" style="width: ${width}px; height: ${height}px;"></div>
            <script>
                const cache = ${settings.cache};

                const options = JSON.parse(\`${JSON.stringify(
                    CALCULATOR_SETTINGS
                )}\`);
                const calculator = Desmos.GraphingCalculator(document.getElementById("calculator"), options);
                ${expressions.join("")}

                calculator.asyncScreenshot({ showLabels: true, format: cache ? "svg" : "png" }, (data) => {
                    if (cache) {
                        parent.postMessage({ t: "desmos-graph", data, hash: "${hash}" }, "app://obsidian.md");                    
                    } else {
                        document.head.innerHTML = "";
                        document.body.innerHTML = "";

                        const img = document.createElement("img");
                        img.src = data;
                        document.body.appendChild(img);
                    }
                });
            </script>
        `;
        const html_src = `<html><head>${html_src_head}</head><body>${html_src_body}</body>`;

        const iframe = document.createElement("iframe");
        iframe.width = width;
        iframe.height = height;
        iframe.style.border = "none";
        iframe.scrolling = "no"; // fixme use a non-depreciated function
        iframe.srcdoc = html_src;

        if (settings.cache) {
            iframe.style.display = "none";
        }

        el.appendChild(iframe);

        if (settings.cache) {
            const handler = (
                message: MessageEvent<{ t: string; data: string; hash: string }>
            ) => {
                if (
                    message.origin === "app://obsidian.md" &&
                    message.data.t === "desmos-graph"
                ) {
                    const { hash, data } = message.data;
                    // todo cache the graph
                    console.log(`Got graph ${hash} with data: ${data}`);
                    window.removeEventListener("message", handler);

                    el.innerHTML = data;
                }
            };

            window.addEventListener("message", handler);
        }
    }
}
