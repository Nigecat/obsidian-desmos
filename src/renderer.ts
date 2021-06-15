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
        const { height, width, equations } = args;

        const expressions = equations.map(
            (equation) =>
                `calculator.setExpression({ latex: "${equation.replace(
                    "\\",
                    "\\\\"
                )}" });`
        );

        const html_src_head = `<script src="https://www.desmos.com/api/v1.6/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>`;
        const html_src_body = `
            <div id="calculator" style="width: ${width}px; height: ${height}px;"></div>
            <script>
                const options = JSON.parse(\`${JSON.stringify(
                    CALCULATOR_SETTINGS
                )}\`);
                const calculator = Desmos.GraphingCalculator(document.getElementById("calculator"), options);
                ${expressions.join("")}

                calculator.asyncScreenshot({ showLabels: true, format: "png" }, (data) => {
                    document.head.innerHTML = "";
                    document.body.innerHTML = "";

                    const img = document.createElement("img");
                    img.src = data;
                    document.body.appendChild(img);
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
        el.appendChild(iframe);
    }
}
