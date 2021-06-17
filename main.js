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

var Field;
(function (Field) {
    Field["Width"] = "width";
    Field["Height"] = "height";
    Field["BoundryLeft"] = "boundry_left";
    Field["BoundryRight"] = "boundry_right";
    Field["BoundryBottom"] = "boundry_bottom";
    Field["BoundryTop"] = "boundry_top";
})(Field || (Field = {}));
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
                .split(/[;\n]+/) // allow either a newline or semicolon as a delimiter
                .map((setting) => setting.trim())
                .filter(Boolean) // remove any empty elements
                .map((setting) => setting.split("=").map((e) => e.trim()))
                .reduce((settings, setting) => {
                if (setting.length < 2) {
                    throw new SyntaxError(`Field '${setting[0]}' must have a value`);
                }
                const s = parseInt(setting[1]);
                const field = Field[setting[0]];
                if (!field) {
                    throw new SyntaxError(`Unrecognised field: ${setting[0]}`);
                }
                settings[field] = s === NaN ? undefined : s;
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
