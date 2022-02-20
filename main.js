'use strict';

var crypto = require('crypto');
var path = require('path');
var os = require('os');
var obsidian = require('obsidian');
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

const FIELD_DEFAULTS = {
    width: 600,
    height: 400,
    boundary_left: -10,
    boundary_right: 10,
    boundary_bottom: -7,
    boundary_top: 7,
};
class Dsl {
    constructor(equations, fields) {
        this.equations = equations;
        this.fields = Object.assign(Object.assign({}, FIELD_DEFAULTS), fields);
        Dsl.assert_sanity(this.fields);
        this.hash = crypto.createHash("sha256")
            .update(JSON.stringify(this))
            .digest("hex");
    }
    /** Check if the fields are sane, throws a `SyntaxError` if they aren't */
    static assert_sanity(fields) {
        // Ensure boundaries are complete and in order
        if (fields.boundary_left >= fields.boundary_right) {
            throw new SyntaxError(`Right boundary (${fields.boundary_right}) must be greater than left boundary (${fields.boundary_left})`);
        }
        if (fields.boundary_bottom >= fields.boundary_top) {
            throw new SyntaxError(`
                Top boundary (${fields.boundary_top}) must be greater than bottom boundary (${fields.boundary_bottom})
            `);
        }
    }
    static parse(source) {
        const split = source.split("---");
        let equations;
        let fields;
        switch (split.length) {
            case 0: {
                equations = [];
                break;
            }
            case 1: {
                equations = split[0].split("\n").filter(Boolean);
                break;
            }
            case 2: {
                // If there are two segments then we know the first one must contain the settings
                fields = split[0]
                    // Allow either a newline or semicolon as a delimiter
                    .split(/[;\n]+/)
                    .map((setting) => setting.trim())
                    // Remove any empty elements
                    .filter(Boolean)
                    // Split each field on the first equals sign to create the key=value pair
                    .map((setting) => {
                    const [key, ...value] = setting.split("=");
                    return [key, value.join("=")];
                })
                    .reduce((settings, [key, value]) => {
                    if (FIELD_DEFAULTS.hasOwnProperty(key)) {
                        if (!value) {
                            throw new SyntaxError(`Field '${key}' must have a value`);
                        }
                        // We can use the defaults to determine the type of each field
                        const field_v = FIELD_DEFAULTS[key];
                        const field_t = typeof field_v;
                        switch (field_t) {
                            case "number": {
                                const s = parseInt(value);
                                if (Number.isNaN(s)) {
                                    throw new SyntaxError(`Field '${key}' must have an integer value`);
                                }
                                settings[key] = s;
                                break;
                            }
                            case "string": {
                                settings[key] = value;
                                break;
                            }
                            case "object": {
                                const val = JSON.parse(value);
                                if (val.constructor === field_v.constructor) {
                                    settings[key] = val;
                                }
                                break;
                            }
                        }
                    }
                    else {
                        throw new SyntaxError(`Unrecognised field: ${key}`);
                    }
                    return settings;
                }, {});
                equations = split[1].split("\n").filter(Boolean);
                break;
            }
            default: {
                fields = {};
            }
        }
        if (!equations) {
            throw new SyntaxError("Too many segments");
        }
        return new Dsl(equations, fields);
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
        const { fields, equations, hash } = args;
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
        const expressions = equations.map((equation) => {
            var _a;
            return `calculator.setExpression({
                    latex: "${equation.split("|")[0].replace("\\", "\\\\")}${((_a = equation.split("|")[1]) !== null && _a !== void 0 ? _a : "")
                .replace("{", "\\\\{")
                .replace("}", "\\\\}")
                .replace("<=", "\\\\leq ")
                .replace(">=", "\\\\geq ")
                .replace("<", "\\\\le ")
                .replace(">", "\\\\ge ")}",
                    
                    ${(() => {
                const mode = equation.split("|")[2];
                if (mode) {
                    if (["solid", "dashed", "dotted"].contains(mode.toLowerCase())) {
                        return `lineStyle: Desmos.Styles.${mode.toUpperCase()}`;
                    }
                    else if (["point", "open", "cross"].contains(mode.toLowerCase())) {
                        return `pointStyle: Desmos.Styles.${mode.toUpperCase()}`;
                    }
                }
                return "";
            })()}
                });`;
        });
        // Because of the electron sandboxing we have to do this inside an iframe,
        // otherwise we can't include the desmos API (although it would be nice if they had a REST API of some sort)
        const html_src_head = `<script src="https://www.desmos.com/api/v1.6/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>`;
        const html_src_body = `
            <div id="calculator" style="width: ${fields.width}px; height: ${fields.height}px;"></div>
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
                    left: ${fields.boundary_left},
                    right: ${fields.boundary_right},
                    top: ${fields.boundary_top},
                    bottom: ${fields.boundary_bottom},
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
        // iframe.style.display = "none"; //fixme hiding the iframe breaks the positioning
        el.appendChild(iframe);
        const handler = (message) => {
            if (message.origin === "app://obsidian.md" &&
                message.data.t === "desmos-graph" &&
                message.data.hash === hash) {
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
    cache: true,
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
            .setDesc("How long to wait after a keypress to render the graph (requires restart to take effect)")
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
