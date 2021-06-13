import { MarkdownPostProcessorContext } from "obsidian";

export class Renderer {
    static handler(
        source: string,
        el: HTMLElement,
        ctx: MarkdownPostProcessorContext
    ) {
        const lines = source.split("\n");

        // todo grab these values from the dsl parser
        const width = "600";
        const height = "400";

        const equations = lines
            .slice(lines.findIndex((row) => row == "---") + 1, -1)
            .map((equation) => equation.replace("\\", "\\\\"));

        // ----------------------------------------

        const CALCULATOR_SETTINGS = {
            settingsMenu: false,
            expressions: false,
            lockViewPort: true,
            zoomButtons: false,
            trace: false,
        };

        const expressions = equations.map(
            (equation) => `calculator.setExpression({ latex: "${equation}" });`
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
            </script>
        `;
        const html_src = `<html><head>${html_src_head}</head><body>${html_src_body}</body>`;

        const iframe = document.createElement("iframe");
        iframe.width = width;
        iframe.height = height;
        iframe.style.border = "none";
        iframe.scrolling = "no"; // fixme shhhhh I know it's depreciated but it works
        iframe.srcdoc = html_src;
        el.appendChild(iframe);
    }
}
