'use strict';

var crypto = require('crypto');
var obsidian = require('obsidian');
var path = require('path');
var os = require('os');
var fs = require('fs');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

class Dsl {
    constructor(equations = [], width = 600, height = 400, boundry_left = -10, boundry_right = 10, boundry_bottom = -7, boundry_top = 7) {
        this.equations = equations;
        this.width = width;
        this.height = height;
        this.boundry_left = boundry_left;
        this.boundry_right = boundry_right;
        this.boundry_bottom = boundry_bottom;
        this.boundry_top = boundry_top;
        this.hash = crypto.createHash("sha256")
            .update(JSON.stringify(this))
            .digest("hex");
    }
    static parse(source) {
        const split = source.split("---");
        // Welcome to ternary hell, have a nice stay
        const equations = split.length == 0
            ? []
            : split.length == 1
                ? split[0].split("\n").filter(Boolean)
                : split.length == 2
                    ? split[1].split("\n").filter(Boolean)
                    : null;
        if (equations == null) {
            throw new SyntaxError("Too many segments");
        }
        const settings = split.length == 2
            ? split[0]
                .split(";")
                .map((setting) => setting.trim())
                .filter(Boolean) // remove any empty elements
                .map((setting) => setting.split("=").map((e) => e.trim()))
                .reduce((settings, setting) => {
                const s = parseInt(setting[1]);
                settings[setting[0]] = s === NaN ? undefined : s;
                return settings;
            }, {})
            : {};
        // Ensure boundaries are complete
        // (basically ensure if we have one value then we also have the other)
        if ((settings.boundry_left === undefined) ==
            (settings.boundry_right != undefined)) {
            throw new SyntaxError("Incomplete boundaries: If you specify one boundry you must also specify the other (boundry_left, boundry_right");
        }
        if ((settings.boundry_bottom === undefined) ==
            (settings.boundry_top != undefined)) {
            throw new SyntaxError("Incomplete boundaries: If you specify one boundry you must also specify the other (boundry_bottom, boundry_top");
        }
        return new Dsl(equations, settings.width, settings.height, settings.boundry_left, settings.boundry_right, settings.boundry_bottom, settings.boundry_top);
    }
}

function renderError(err, el) {
    el.innerHTML = `
    <div style="padding: 20px; background-color: #f44336; color: white;">
        <strong>Desmos Graph Error:</strong> ${err}
    </div>`;
}

class Renderer {
    static render(args, settings, el, plugin) {
        const { height, width, equations, hash } = args;
        // Calculate cache info for filesystem caching
        const vault_root = plugin.app.vault.adapter.basePath;
        const cache_dir = settings.cache_directory
            ? path__default['default'].isAbsolute(settings.cache_directory)
                ? settings.cache_directory
                : path__default['default'].join(vault_root, settings.cache_directory)
            : os.tmpdir();
        const cache_target = path__default['default'].join(cache_dir, `desmos-graph-${hash}.png`);
        // If this graph is in the cache then fetch it
        if (settings.cache) {
            if (settings.cache_location == "memory" &&
                hash in plugin.graph_cache) {
                const data = plugin.graph_cache[hash];
                const img = document.createElement("img");
                img.src = data;
                el.appendChild(img);
                return;
            }
            else if (settings.cache_location == "filesystem" &&
                fs.existsSync(cache_target)) {
                fs.promises.readFile(cache_target).then((data) => {
                    const b64 = "data:image/png;base64," +
                        Buffer.from(data).toString("base64");
                    const img = document.createElement("img");
                    img.src = b64;
                    el.appendChild(img);
                });
                return;
            }
        }
        const expressions = equations.map((equation) => `calculator.setExpression({ latex: "${equation.replace("\\", "\\\\")}" });`);
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
        const handler = (message) => {
            if (message.origin === "app://obsidian.md" &&
                message.data.t === "desmos-graph") {
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
                        }
                        else if (settings.cache_location == "filesystem") {
                            if (fs.existsSync(cache_dir)) {
                                fs.promises.writeFile(cache_target, data.replace(/^data:image\/png;base64,/, ""), "base64").catch((err) => new obsidian.Notice(`desmos-graph: unexpected error when trying to cache graph: ${err}`, 10000));
                            }
                            else {
                                new obsidian.Notice(`desmos-graph: cache directory not found: '${cache_dir}'`, 10000);
                            }
                        }
                    }
                }
            }
        };
        window.addEventListener("message", handler);
    }
}

const DEFAULT_SETTINGS = {
    debounce: 500,
    cache: false,
    cache_location: "memory",
    cache_directory: null,
};
class SettingsTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName("Debounce Time (ms)")
            .setDesc("How long to wait after a keypress to render the graph (requires restart to take affect)")
            .addText((text) => text
            .setValue(this.plugin.settings.debounce.toString())
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            const val = parseInt(value);
            this.plugin.settings.debounce =
                val === NaN ? DEFAULT_SETTINGS.debounce : val;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName("Cache")
            .setDesc("Whether to cache the rendered graphs")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.cache)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.cache = value;
            yield this.plugin.saveSettings();
            // Reset the display so the new state can render
            this.display();
        })));
        if (this.plugin.settings.cache) {
            new obsidian.Setting(containerEl)
                .setName("Cache in memory (alternate: filesystem)")
                .setDesc("Cache rendered graphs in memory or on the filesystem (note that memory caching is not persistent).")
                .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.cache_location === "memory"
                ? true
                : false)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.cache_location = value
                    ? "memory"
                    : "filesystem";
                yield this.plugin.saveSettings();
                // Reset the display so the new state can render
                this.display();
            })));
            if (this.plugin.settings.cache_location == "filesystem") {
                new obsidian.Setting(containerEl)
                    .setName("Cache Directory")
                    .setDesc("The directory to save cached graphs in (technical note: the graphs will be saved as `desmos-graph-<hash>.png` where the name is a SHA-256 hash of the graph source). The default directory is the system tempdir for your current operating system, and this value may be either a path relative to the root of your vault or an absolute path. Also note that a lot of junk will be saved to this folder, you have been warned.")
                    .addText((text) => text
                    .setPlaceholder(os.tmpdir())
                    .setValue(this.plugin.settings.cache_directory)
                    .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                    this.plugin.settings.cache_directory = value;
                    yield this.plugin.saveSettings();
                })));
            }
        }
    }
}

class Desmos extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            this.graph_cache = {};
            yield this.loadSettings();
            this.addSettingTab(new SettingsTab(this.app, this));
            // Keep track of the total number of graphs in each file
            // This allows us to skip the debounce on recently opened files to make it feel snappier to use
            let total = 0;
            this.app.workspace.on("file-open", (file) => __awaiter(this, void 0, void 0, function* () {
                const contents = yield this.app.vault.cachedRead(file);
                // Attempt to figure out the number of graphs there are in this file
                // In this case it is fine if we overestimate because we only need a general idea since this just makes it skip the debounce
                total = (contents.match(/```desmos-graph/g) || []).length;
            }));
            const render = (source, el) => {
                try {
                    Renderer.render(Dsl.parse(source), this.settings, el, this);
                }
                catch (err) {
                    renderError(err.message, el);
                }
            };
            const debounce_render = obsidian.debounce((source, el) => render(source, el), this.settings.debounce);
            this.registerMarkdownCodeBlockProcessor("desmos-graph", (source, el) => {
                if (total > 0) {
                    total--;
                    // Skip the debounce on initial render
                    render(source, el);
                }
                else {
                    debounce_render(source, el);
                }
            });
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
}

module.exports = Desmos;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9kc2wudHMiLCJzcmMvZXJyb3IudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6bnVsbCwibmFtZXMiOlsiY3JlYXRlSGFzaCIsInBhdGgiLCJ0bXBkaXIiLCJleGlzdHNTeW5jIiwiZnMiLCJOb3RpY2UiLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIlBsdWdpbiIsImRlYm91bmNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBdURBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ2hILElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQy9ELFFBQVEsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNuRyxRQUFRLFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUks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
