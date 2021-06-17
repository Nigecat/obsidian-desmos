import path from "path";
import Desmos from "./main";
import { Dsl } from "./dsl";
import { tmpdir } from "os";
import { Notice } from "obsidian";
import { Settings } from "./settings";
import { renderError } from "./error";
import { existsSync, promises as fs } from "fs";

export class Renderer {
    static render(
        args: Dsl,
        settings: Settings,
        el: HTMLElement,
        plugin: Desmos
    ) {
        const { height, width, equations, hash } = args;

        // Calculate cache info for filesystem caching
        const vault_root = (plugin.app.vault.adapter as any).basePath;
        const cache_dir = settings.cache_directory
            ? path.isAbsolute(settings.cache_directory)
                ? settings.cache_directory
                : path.join(vault_root, settings.cache_directory)
            : tmpdir();
        const cache_target = path.join(cache_dir, `desmos-graph-${hash}.png`);

        // If this graph is in the cache then fetch it
        if (settings.cache) {
            if (
                settings.cache_location == "memory" &&
                hash in plugin.graph_cache
            ) {
                const data = plugin.graph_cache[hash];
                const img = document.createElement("img");
                img.src = data;
                el.appendChild(img);
                return;
            } else if (
                settings.cache_location == "filesystem" &&
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
                const options = {
                    settingsMenu: false,
                    expressions: false,
                    lockViewPort: true,
                    zoomButtons: false,
                    trace: false,
                };

                const calculator = Desmos.GraphingCalculator(document.getElementById("calculator"), options);
                calculator.setMathBounds({
                    left: ${args.boundry_left},
                    right: ${args.boundry_right},
                    top: ${args.boundry_top},
                    bottom: ${args.boundry_bottom},
                });
                
                ${expressions.join("")}

                calculator.observe("expressionAnalysis", () => {
                    for (const id in calculator.expressionAnalysis) {
                        const analysis = calculator.expressionAnalysis[id];
                        if (analysis.isError) {
                            parent.postMessage({ t: "desmos-graph", d: "error", data: analysis.errorMessage });
                        }
                    }
                });

                calculator.asyncScreenshot({ showLabels: true, format: "png" }, (data) => {
                    document.body.innerHTML = "";
                    parent.postMessage({ t: "desmos-graph", d: "render", data }, "app://obsidian.md");                    
                });
            </script>
        `;
        const html_src = `<html><head>${html_src_head}</head><body>${html_src_body}</body>`;

        const iframe = document.createElement("iframe");
        iframe.width = width.toString();
        iframe.height = height.toString();
        iframe.style.border = "none";
        iframe.scrolling = "no"; // fixme use a non-depreciated function
        iframe.srcdoc = html_src;
        // iframe.style.display = "none"; //fixme hiding the iframe breaks the positioning

        el.appendChild(iframe);

        const handler = (
            message: MessageEvent<{ t: string; d: string; data: string }>
        ) => {
            if (
                message.origin === "app://obsidian.md" &&
                message.data.t === "desmos-graph"
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

                    if (settings.cache) {
                        if (settings.cache_location == "memory") {
                            plugin.graph_cache[hash] = data;
                        } else if (settings.cache_location == "filesystem") {
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
    }
}
