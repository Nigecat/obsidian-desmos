import Desmos from "./main";
import { renderError } from "./error";
import { CacheLocation } from "./settings";
import { Dsl, EquationStyle } from "./dsl";
import { normalizePath, Notice } from "obsidian";

interface RenderData {
    args: Dsl;
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

    public render(args: Dsl, el: HTMLElement): Promise<void> {
        return new Promise(async (resolve) => {
            const plugin = this.plugin;
            const settings = plugin.settings;

            const { fields, equations } = args;
            const hash = await args.hash();

            let cacheFile: string | undefined;

            // If this graph is in the cache then fetch it
            if (settings.cache.enabled) {
                if (settings.cache.location === CacheLocation.Memory && hash in plugin.graphCache) {
                    const data = plugin.graphCache[hash];
                    const img = document.createElement("img");
                    img.src = data;
                    el.appendChild(img);
                    resolve();
                    return;
                } else if (settings.cache.location === CacheLocation.Filesystem && settings.cache.directory) {
                    const adapter = plugin.app.vault.adapter;

                    cacheFile = normalizePath(`${settings.cache.directory}/desmos-graph-${hash}.png`);
                    // If this graph is in the cache
                    if (await adapter.exists(cacheFile)) {
                        const img = document.createElement("img");
                        img.src = adapter.getResourcePath(cacheFile);
                        el.appendChild(img);
                        resolve();
                        return;
                    }
                }
            }

            const expressions = equations.map(
                (equation) =>
                    `calculator.setExpression({
                    latex: "${equation.equation.replace("\\", "\\\\")}${
                        // interpolation is safe as we ensured the string did not contain any quotes in the parser
                        (equation.restriction ?? "")
                            .replaceAll("{", "\\\\{")
                            .replaceAll("}", "\\\\}")
                            .replaceAll("<=", "\\\\leq ")
                            .replaceAll(">=", "\\\\geq ")
                            .replaceAll("<", "\\\\le ")
                            .replaceAll(">", "\\\\ge ")
                    }",

                    ${(() => {
                        if (equation.style) {
                            if (
                                [EquationStyle.Solid, EquationStyle.Dashed, EquationStyle.Dotted].contains(
                                    equation.style
                                )
                            ) {
                                return `lineStyle: Desmos.Styles.${equation.style},`;
                            } else if (
                                [EquationStyle.Point, EquationStyle.Open, EquationStyle.Cross].contains(equation.style)
                            ) {
                                return `pointStyle: Desmos.Styles.${equation.style},`;
                            }
                        }

                        return "";
                    })()}

                    ${
                        equation.color
                            ? `color: "${equation.color}",` // interpolation is safe as we ensured the string was alphanumeric in the parser
                            : ""
                    }
                });`
            );

            // Because of the electron sandboxing we have to do this inside an iframe (and regardless this is safer),
            //   otherwise we can't include the desmos API (although it would be nice if they had a REST API of some sort)
            // Interestingly enough, this script functions perfectly fine fully offline - so we could include a vendored copy if need be
            //   (the script gets cached by electron the first time it's used so this isn't a particularly high priority)
            const htmlHead = `<script src="https://www.desmos.com/api/v1.6/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>`;
            const htmlBody = `
            <div id="calculator-${hash}" style="width: ${fields.width}px; height: ${fields.height}px;"></div>
            <script>
                const options = {
                    settingsMenu: false,
                    expressions: false,
                    lockViewPort: true,
                    zoomButtons: false,
                    trace: false,
                    showGrid: ${fields.grid},
                };

                const calculator = Desmos.GraphingCalculator(document.getElementById("calculator-${hash}"), options);
                calculator.setMathBounds({
                    left: ${fields.left},
                    right: ${fields.right},
                    top: ${fields.top},
                    bottom: ${fields.bottom},
                });

                ${expressions.join("")}

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

                calculator.asyncScreenshot({ showLabels: true, format: "png" }, (data) => {
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
            iframe.width = fields.width.toString();
            iframe.height = fields.height.toString();
            iframe.style.border = "none";
            iframe.scrolling = "no"; // fixme use a non-depreciated function
            iframe.srcdoc = htmlSrc;
            // iframe.style.display = "none"; // fixme hiding the iframe breaks the positioning

            el.appendChild(iframe);

            this.rendering.set(hash, { args, el, resolve, cacheFile });
        });
    }

    private async handler(
        message: MessageEvent<{ t: string; d: string; o: string; data: string; hash: string }>
    ): Promise<void> {
        if (message.data.o === window.origin && message.data.t === "desmos-graph") {
            const state = this.rendering.get(message.data.hash);
            if (state) {
                const { args, el, resolve, cacheFile } = state;

                el.empty();

                if (message.data.d === "error") {
                    renderError(message.data.data, el, args.potentialErrorCause);
                    resolve(); // let caller know we are done rendering
                } else if (message.data.d === "render") {
                    const { data } = message.data;

                    const img = document.createElement("img");
                    img.src = data;
                    el.appendChild(img);
                    resolve(); // let caller know we are done rendering

                    const plugin = this.plugin;
                    const settings = plugin.settings;
                    const hash = await args.hash();
                    if (settings.cache.enabled) {
                        if (settings.cache.location === CacheLocation.Memory) {
                            plugin.graphCache[hash] = data;
                        } else if (settings.cache.location === CacheLocation.Filesystem) {
                            const adapter = plugin.app.vault.adapter;

                            if (cacheFile && settings.cache.directory) {
                                if (await adapter.exists(settings.cache.directory)) {
                                    const buffer = Buffer.from(data.replace(/^data:image\/png;base64,/, ""), "base64");
                                    await adapter.writeBinary(cacheFile, buffer);
                                } else {
                                    // tslint:disable-next-line:no-unused-expression
                                    new Notice(
                                        `desmos-graph: target cache directory '${settings.cache.directory}' does not exist, skipping cache`,
                                        10000
                                    );
                                }
                            } else {
                                // tslint:disable-next-line:no-unused-expression
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
                console.warn(`Got graph not in render list, this is probably a bug - ${this.rendering}`);
            }
        }
    }
}
