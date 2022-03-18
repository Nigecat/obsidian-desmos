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
    left: -10,
    right: 10,
    bottom: -7,
    top: 7,
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
        if (fields.left >= fields.right) {
            throw new SyntaxError(`Right boundary (${fields.right}) must be greater than left boundary (${fields.left})`);
        }
        if (fields.bottom >= fields.top) {
            throw new SyntaxError(`
                Top boundary (${fields.top}) must be greater than bottom boundary (${fields.bottom})
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

var CacheLocation;
(function (CacheLocation) {
    CacheLocation["Memory"] = "Memory";
    CacheLocation["Filesystem"] = "Filesystem";
})(CacheLocation || (CacheLocation = {}));
const DEFAULT_SETTINGS_STATIC = {
    debounce: 500,
    cache: {
        enabled: true,
        location: CacheLocation.Memory,
    },
};
/** Get the default settings for the given plugin.
 * This simply uses `DEFAULT_SETTINGS_STATIC` and patches the version from the manifest. */
function DEFAULT_SETTINGS(plugin) {
    return Object.assign({ version: plugin.manifest.version }, DEFAULT_SETTINGS_STATIC);
}
/** Attempt to migrate the given settings object to the current structure */
function migrateSettings(plugin, settings) {
    // todo (there is currently only one version of the settings interface)
    return settings;
}
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
                val === NaN
                    ? DEFAULT_SETTINGS_STATIC.debounce
                    : val;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName("Cache")
            .setDesc("Whether to cache the rendered graphs")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.cache.enabled)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.cache.enabled = value;
            yield this.plugin.saveSettings();
            // Reset the display so the new state can render
            this.display();
        })));
        if (this.plugin.settings.cache.enabled) {
            new obsidian.Setting(containerEl)
                .setName("Cache location")
                .setDesc("Set the location to cache rendered graphs (note that memory caching is not persistent)")
                .addDropdown((dropdown) => dropdown
                .addOption(CacheLocation.Memory, "Memory")
                .addOption(CacheLocation.Filesystem, "Filesystem")
                .setValue(this.plugin.settings.cache.location)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.cache.location =
                    value;
                yield this.plugin.saveSettings();
                // Reset the display so the new state can render
                this.display();
            })));
            if (this.plugin.settings.cache.location == CacheLocation.Filesystem) {
                new obsidian.Setting(containerEl)
                    .setName("Cache Directory")
                    .setDesc("The directory to save cached graphs in (technical note: the graphs will be saved as `desmos-graph-<hash>.png` where the name is a SHA-256 hash of the graph source). The default directory is the system tempdir for your current operating system, and this value may be either a path relative to the root of your vault or an absolute path. Also note that a lot of junk will be saved to this folder, you have been warned.")
                    .addText((text) => text
                    .setPlaceholder(os.tmpdir())
                    .setValue(this.plugin.settings.cache.directory)
                    .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                    this.plugin.settings.cache.directory = value;
                    yield this.plugin.saveSettings();
                })));
            }
        }
    }
}

class Renderer {
    static render(args, settings, el, plugin) {
        return new Promise((resolve) => {
            const { fields, equations, hash } = args;
            // Calculate cache info for filesystem caching
            const vault_root = plugin.app.vault.adapter.basePath;
            const cache_dir = settings.cache.directory
                ? path__default['default'].isAbsolute(settings.cache.directory)
                    ? settings.cache.directory
                    : path__default['default'].join(vault_root, settings.cache.directory)
                : os.tmpdir();
            const cache_target = path__default['default'].join(cache_dir, `desmos-graph-${hash}.png`);
            // If this graph is in the cache then fetch it
            if (settings.cache) {
                if (settings.cache.location == CacheLocation.Memory &&
                    hash in plugin.graph_cache) {
                    const data = plugin.graph_cache[hash];
                    const img = document.createElement("img");
                    img.src = data;
                    el.appendChild(img);
                    return;
                }
                else if (settings.cache.location == CacheLocation.Filesystem &&
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
                        resolve(); // let caller know we are done rendering
                        if (settings.cache) {
                            if (settings.cache.location == CacheLocation.Memory) {
                                plugin.graph_cache[hash] = data;
                            }
                            else if (settings.cache.location ==
                                CacheLocation.Filesystem) {
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
        });
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
            const render = (source, el) => __awaiter(this, void 0, void 0, function* () {
                try {
                    return Renderer.render(Dsl.parse(source), this.settings, el, this);
                }
                catch (err) {
                    renderError(err.message, el);
                }
            });
            const debounce_render = obsidian.debounce((source, el) => render(source, el), this.settings.debounce);
            this.registerMarkdownCodeBlockProcessor("desmos-graph", (source, el) => {
                if (total > 0 ||
                    !this.settings.debounce ||
                    this.settings.debounce < 1) {
                    total--;
                    // Skip the debounce on initial render (or if there is no valid debounce set)
                    return render(source, el);
                }
                else {
                    return debounce_render(source, el);
                }
            });
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            let settings = yield this.loadData();
            if (!settings) {
                settings = DEFAULT_SETTINGS(this);
            }
            if (settings.version != this.manifest.version) {
                settings = migrateSettings(this, settings);
            }
            this.settings = settings;
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
}

module.exports = Desmos;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9kc2wudHMiLCJzcmMvZXJyb3IudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6bnVsbCwibmFtZXMiOlsiY3JlYXRlSGFzaCIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwidG1wZGlyIiwicGF0aCIsImV4aXN0c1N5bmMiLCJmcyIsIk5vdGljZSIsIlBsdWdpbiIsImRlYm91bmNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBdURBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ2hILElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQy9ELFFBQVEsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNuRyxRQUFRLFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUks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
