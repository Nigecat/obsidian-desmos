import Desmos from "./main";
import { ucast } from "./utils";
import { renderError } from "./error";
import { CacheLocation } from "./settings";
import { normalizePath, Notice } from "obsidian";
import { DegreeMode, Graph, LineStyle, PointStyle } from "./graph";

/** Parse an SVG into a DOM element */
function parseSVG(svg: string): HTMLElement {
    return new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
}

interface RenderData {
    graph: Graph;
    el: HTMLElement;
    cacheFile?: string;
    resolve: () => void;
}

export class Renderer {
    private readonly plugin: Desmos;
    /** The set of graphs we are currently rendering, mapped by their hash */
    private rendering: Map<string, RenderData> = new Map();
    private active: boolean;

    public constructor(plugin: Desmos) {
        this.plugin = plugin;
        this.active = false;
    }

    public activate() {
        if (!this.active) {
            window.addEventListener("message", this.handler.bind(this));
            this.active = true;
        }
    }

    public deactivate() {
        if (this.active) {
            window.removeEventListener("message", this.handler.bind(this));
            this.active = false;
        }
    }

    public async render(graph: Graph, el: HTMLElement): Promise<void> {
        const plugin = this.plugin;
        const settings = plugin.settings;

        const equations = graph.equations;
        const graphSettings = graph.settings;
        const hash = await graph.hash();

        let cacheFile: string | undefined;

        // If this graph is in the cache then fetch it
        if (settings.cache.enabled) {
            if (settings.cache.location === CacheLocation.Memory && hash in plugin.graphCache) {
                const data = plugin.graphCache[hash];
                el.appendChild(parseSVG(data));
                return;
            } else if (settings.cache.location === CacheLocation.Filesystem && settings.cache.directory) {
                const adapter = plugin.app.vault.adapter;

                cacheFile = normalizePath(`${settings.cache.directory}/desmos-graph-${hash}.svg`);
                // If this graph is in the cache
                if (await adapter.exists(cacheFile)) {
                    const data = await adapter.read(cacheFile);
                    el.appendChild(parseSVG(data));
                    return;
                }
            }
        }

        // Parse equations into a series of Desmos expressions
        const expressions: string[] = [];
        for (const equation of equations) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const expression: any = {
                color: equation.color,
                label: equation.label,
                showLabel: equation.label !== undefined,
            };

            if (equation.restrictions) {
                const restriction = equation.restrictions
                    .map((restriction) =>
                        `{${restriction}}`
                            // Escape chars
                            .replaceAll("{", String.raw`\{`)
                            .replaceAll("}", String.raw`\}`)
                            .replaceAll("<=", String.raw`\leq `)
                            .replaceAll(">=", String.raw`\geq `)
                            .replaceAll("<", String.raw`\le `)
                            .replaceAll(">", String.raw`\ge `)
                    )
                    .join("");

                expression.latex = `${equation.equation}${restriction}`;
            } else {
                expression.latex = equation.equation;
            }

            if (equation.style) {
                if (Object.values(LineStyle).includes(ucast(equation.style))) {
                    expression.lineStyle = equation.style;
                } else if (Object.values(PointStyle).includes(ucast(equation.style))) {
                    expression.pointStyle = equation.style;
                }
            }

            // Calling JSON.stringify twice allows us to escape the strings as well,
            //  meaning we can embed it directly into the calculator to undo the first stringification without parsing
            expressions.push(`calculator.setExpression(JSON.parse(${JSON.stringify(JSON.stringify(expression))}));`);
        }

        // Because of the electron sandboxing we have to do this inside an iframe (and regardless this is safer),
        //   otherwise we can't include the desmos API (although it would be nice if they had a REST API of some sort)
        // Interestingly enough, this script functions perfectly fine fully offline - so we could include a vendored copy if need be
        //   (the script gets cached by electron the first time it's used so this isn't a particularly high priority)
        const htmlHead = `<script src="https://www.desmos.com/api/v1.6/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>`;
        const htmlBody = `
            <div id="calculator-${hash}" style="width: ${graphSettings.width}px; height: ${
            graphSettings.height
        }px;"></div>
            <script>
                const options = {
                    settingsMenu: false,
                    expressions: false,
                    lockViewPort: true,
                    zoomButtons: false,
                    trace: false,
                    showGrid: ${graphSettings.grid},
                    // Desmos takes a value of 'false' for radians and 'true' for degrees
                    degreeMode: ${graphSettings.degreeMode === DegreeMode.Degrees},
                };

                const calculator = Desmos.GraphingCalculator(document.getElementById("calculator-${hash}"), options);
                calculator.setMathBounds({
                    left: ${graphSettings.left},
                    right: ${graphSettings.right},
                    top: ${graphSettings.top},
                    bottom: ${graphSettings.bottom},
                });

                ${expressions.join("\n")}

                // Desmos returns an error if we try to observe the expressions without any defined
                if (${expressions.length > 0}) {
                    calculator.observe("expressionAnalysis", () => {
                        for (const id in calculator.expressionAnalysis) {
                            const analysis = calculator.expressionAnalysis[id];
                            if (analysis.isError) {
                                parent.postMessage({ t: "desmos-graph", d: "error", o: "${
                                    window.origin
                                }", data: analysis.errorMessage, hash: "${hash}" }, "${window.origin}");
                            }
                        }
                    });
                }

                calculator.asyncScreenshot({ showLabels: true, format: "svg" }, (data) => {
                    document.body.innerHTML = "";
                    parent.postMessage({ t: "desmos-graph", d: "render", o: "${
                        window.origin
                    }", data, hash: "${hash}" }, "${window.origin}");
                });
            </script>
        `;
        const htmlSrc = `<html><head>${htmlHead}</head><body>${htmlBody}</body>`;

        const iframe = document.createElement("iframe");
        iframe.sandbox.add("allow-scripts"); // enable sandbox mode - this prevents any xss exploits from an untrusted source in the frame (and prevents it from accessing the parent)
        iframe.width = graphSettings.width.toString();
        iframe.height = graphSettings.height.toString();
        iframe.className = "desmos-graph";
        iframe.style.border = "none";
        iframe.scrolling = "no"; // fixme use a non-depreciated function
        iframe.srcdoc = htmlSrc;
        // iframe.style.display = "none"; // fixme hiding the iframe breaks the positioning

        el.appendChild(iframe);

        return new Promise((resolve) => this.rendering.set(hash, { graph, el, resolve, cacheFile }));
    }

    private async handler(
        message: MessageEvent<{ t: string; d: string; o: string; data: string; hash: string }>
    ): Promise<void> {
        if (message.data.o === window.origin && message.data.t === "desmos-graph") {
            const state = this.rendering.get(message.data.hash);
            if (state) {
                const { graph, el, resolve, cacheFile } = state;

                el.empty();

                if (message.data.d === "error") {
                    renderError(message.data.data, el, graph.potentialErrorHint?.view);
                    resolve(); // let caller know we are done rendering
                } else if (message.data.d === "render") {
                    const { data } = message.data;

                    const node = parseSVG(data);
                    node.setAttribute("class", "desmos-graph");
                    el.appendChild(node);
                    resolve(); // let caller know we are done rendering

                    const plugin = this.plugin;
                    const settings = plugin.settings;
                    const hash = await graph.hash();
                    if (settings.cache.enabled) {
                        if (settings.cache.location === CacheLocation.Memory) {
                            plugin.graphCache[hash] = data;
                        } else if (settings.cache.location === CacheLocation.Filesystem) {
                            const adapter = plugin.app.vault.adapter;

                            if (cacheFile && settings.cache.directory) {
                                if (await adapter.exists(settings.cache.directory)) {
                                    await adapter.write(cacheFile, data);
                                } else {
                                    new Notice(
                                        `desmos-graph: target cache directory '${settings.cache.directory}' does not exist, skipping cache`,
                                        10000
                                    );
                                }
                            } else {
                                new Notice(
                                    `desmos-graph: filesystem caching enabled but no cache directory set, skipping cache`,
                                    10000
                                );
                            }
                        }
                    }
                }

                this.rendering.delete(message.data.hash);
            } else {
                // do nothing if graph is not in render list (this should not happen)
                console.warn(
                    `Got graph not in render list, this is probably a bug - ${JSON.stringify(this.rendering)}`
                );
            }
        }
    }
}
