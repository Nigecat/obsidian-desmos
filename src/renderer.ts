import path from "path";
import Desmos from "./main";
import { tmpdir } from "os";
import { Notice } from "obsidian";
import { renderError } from "./error";
import { existsSync, promises as fs } from "fs";
import { CacheLocation, Settings } from "./settings";
import { Dsl, EquationStyle, isHexColor } from "./dsl";

export class Renderer {
    static render(
        args: Dsl,
        settings: Settings,
        el: HTMLElement,
        plugin: Desmos
    ): Promise<void> {
        return new Promise((resolve) => {
            const { fields, equations, hash } = args;

            // Calculate cache info for filesystem caching
            const vault_root = (plugin.app.vault.adapter as any).basePath;
            const cache_dir = settings.cache.directory
                ? path.isAbsolute(settings.cache.directory)
                    ? settings.cache.directory
                    : path.join(vault_root, settings.cache.directory)
                : tmpdir();
            const cache_target = path.join(
                cache_dir,
                `desmos-graph-${hash}.png`
            );

            // If this graph is in the cache then fetch it
            if (settings.cache) {
                if (
                    settings.cache.location == CacheLocation.Memory &&
                    hash in plugin.graph_cache
                ) {
                    const data = plugin.graph_cache[hash];
                    const img = document.createElement("img");
                    img.src = data;
                    el.appendChild(img);
                    return;
                } else if (
                    settings.cache.location == CacheLocation.Filesystem &&
                    existsSync(cache_target)
                ) {
                    fs.readFile(cache_target).then((data) => {
                        const b64 =
                            "data:image/png;base64," +
                            Buffer.from(data).toString("base64");
                        const img = document.createElement("img");
                        img.src = b64;
                        el.appendChild(img);
                    });
                    return;
                }
            }

            const expressions = equations.map(
                (equation) =>
                    `calculator.setExpression({
                    latex: "${equation.equation.replace("\\", "\\\\")}${(
                        equation.restriction ?? ""
                    )
                        .replaceAll("{", "\\\\{")
                        .replaceAll("}", "\\\\}")
                        .replaceAll("<=", "\\\\leq ")
                        .replaceAll(">=", "\\\\geq ")
                        .replaceAll("<", "\\\\le ")
                        .replaceAll(">", "\\\\ge ")}",
                    
                    ${(() => {
                        if (equation.style) {
                            if (
                                [
                                    EquationStyle.Solid,
                                    EquationStyle.Dashed,
                                    EquationStyle.Dotted,
                                ].contains(equation.style)
                            ) {
                                return `lineStyle: Desmos.Styles.${equation.style},`;
                            } else if (
                                [
                                    EquationStyle.Point,
                                    EquationStyle.Open,
                                    EquationStyle.Cross,
                                ].contains(equation.style)
                            ) {
                                return `pointStyle: Desmos.Styles.${equation.style},`;
                            }
                        }

                        return "";
                    })()}

                    ${(() => {
                        if (equation.color) {
                            if (isHexColor(equation.color)) {
                                return `color: "${equation.color}",`; // interpolation is safe as we ensured the string was alphanumeric in the parser
                            } else {
                                return `color: Desmos.Colors.${equation.color},`;
                            }
                        }

                        return "";
                    })()}
                });`
            );

            // Because of the electron sandboxing we have to do this inside an iframe,
            // otherwise we can't include the desmos API (although it would be nice if they had a REST API of some sort)
            const html_src_head = `<script src="https://www.desmos.com/api/v1.6/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>`;
            const html_src_body = `
            <div id="calculator" style="width: ${fields.width}px; height: ${
                fields.height
            }px;"></div>
            <script>
                const options = {
                    settingsMenu: false,
                    expressions: false,
                    lockViewPort: true,
                    zoomButtons: false,
                    trace: false,
                };

                const calculator = Desmos.GraphingCalculator(document.getElementById("calculator"), options);
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
                            parent.postMessage({ t: "desmos-graph", d: "error", data: analysis.errorMessage, hash: "${hash}" });
                        }
                    }
                });

                calculator.asyncScreenshot({ showLabels: true, format: "png" }, (data) => {
                    document.body.innerHTML = "";
                    parent.postMessage({ t: "desmos-graph", d: "render", data, hash: "${hash}" }, "app://obsidian.md");
                });
            </script>
        `;
            const html_src = `<html><head>${html_src_head}</head><body>${html_src_body}</body>`;

            const iframe = document.createElement("iframe");
            iframe.width = fields.width.toString();
            iframe.height = fields.height.toString();
            iframe.style.border = "none";
            iframe.scrolling = "no"; // fixme use a non-depreciated function
            iframe.srcdoc = html_src;
            // iframe.style.display = "none"; // fixme hiding the iframe breaks the positioning

            el.appendChild(iframe);

            const handler = (
                message: MessageEvent<{
                    t: string;
                    d: string;
                    data: string;
                    hash: string;
                }>
            ) => {
                if (
                    message.origin === "app://obsidian.md" &&
                    message.data.t === "desmos-graph" &&
                    message.data.hash === hash
                ) {
                    el.empty();

                    if (message.data.d === "error") {
                        renderError(message.data.data, el);
                    }

                    if (message.data.d === "render") {
                        const { data } = message.data;
                        window.removeEventListener("message", handler);

                        const img = document.createElement("img");
                        img.src = data;
                        el.appendChild(img);
                        resolve(); // let caller know we are done rendering

                        if (settings.cache) {
                            if (
                                settings.cache.location == CacheLocation.Memory
                            ) {
                                plugin.graph_cache[hash] = data;
                            } else if (
                                settings.cache.location ==
                                CacheLocation.Filesystem
                            ) {
                                if (existsSync(cache_dir)) {
                                    fs.writeFile(
                                        cache_target,
                                        data.replace(
                                            /^data:image\/png;base64,/,
                                            ""
                                        ),
                                        "base64"
                                    ).catch(
                                        (err) =>
                                            new Notice(
                                                `desmos-graph: unexpected error when trying to cache graph: ${err}`,
                                                10000
                                            )
                                    );
                                } else {
                                    new Notice(
                                        `desmos-graph: cache directory not found: '${cache_dir}'`,
                                        10000
                                    );
                                }
                            }
                        }
                    }
                }
            };

            window.addEventListener("message", handler);
        });
    }
}
