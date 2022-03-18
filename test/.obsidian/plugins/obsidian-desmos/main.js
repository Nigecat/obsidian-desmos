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
var EquationStyle;
(function (EquationStyle) {
    EquationStyle["Solid"] = "SOLID";
    EquationStyle["Dashed"] = "DASHED";
    EquationStyle["Dotted"] = "DOTTED";
    EquationStyle["Point"] = "POINT";
    EquationStyle["Open"] = "OPEN";
    EquationStyle["Cross"] = "CROSS";
})(EquationStyle || (EquationStyle = {}));
var EquationColor;
(function (EquationColor) {
    EquationColor["Red"] = "RED";
    EquationColor["Blue"] = "BLUE";
    EquationColor["Green"] = "GREEN";
    EquationColor["Purple"] = "PURPLE";
    EquationColor["Orange"] = "ORANGE";
    EquationColor["Black"] = "BLACK";
})(EquationColor || (EquationColor = {}));
function isHexColor(value) {
    if (value.startsWith("#")) {
        value = value.slice(1);
        // Ensure the rest of the value is a valid alphanumeric string
        if (/^[0-9a-zA-Z]+$/.test(value)) {
            return true;
        }
    }
    return false;
}
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
    /** Ensure a string does not contain any of the banned characters
     *  (this is mostly a sanity check to prevent vulnerabilities in later interpolation) */
    static assert_notbanned(value, ctx) {
        const bannedChars = ['"', "'", "`"];
        for (const c of bannedChars) {
            if (value.includes(c)) {
                throw new SyntaxError(`Unexpected character ${c} in ${ctx}`);
            }
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
                                this.assert_notbanned(value, `field value for key: '${key}'`);
                                settings[key] = value;
                                break;
                            }
                            // case "object": {
                            //     const val = JSON.parse(value);
                            //     if (
                            //         val.constructor === field_v.constructor
                            //     ) {
                            //         (settings as any)[key] = val;
                            //     }
                            //     break;
                            // }
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
        // Process equations
        const processed = equations.map((eq) => {
            const segments = eq.split("|");
            // First segment is always the equation
            const equation = { equation: segments.shift() };
            this.assert_notbanned(equation.equation, "graph equation");
            // The rest of the segments can either be the restriction, style, or color
            //  whilst we recommend putting the restriction first, we accept these in any order.
            for (const segment of segments) {
                const segmentUpperCase = segment.toUpperCase();
                // If this is a valid style constant
                if (Object.values(EquationStyle).includes(segmentUpperCase)) {
                    if (!equation.style) {
                        equation.style = segmentUpperCase;
                    }
                    else {
                        throw new SyntaxError(`Duplicate style identifiers detected: ${equation.style}, ${segmentUpperCase}`);
                    }
                }
                // If this is a valid color constant or hex code
                else if (Object.values(EquationColor).includes(segmentUpperCase) ||
                    isHexColor(segment)) {
                    if (!equation.color) {
                        if (isHexColor(segment)) {
                            equation.color = segment;
                        }
                        else {
                            equation.color = segmentUpperCase;
                        }
                    }
                    else {
                        throw new SyntaxError(`Duplicate color identifiers detected: ${equation.color}, ${segmentUpperCase}`);
                    }
                }
                // Otherwise, assume it is a graph restriction
                else {
                    this.assert_notbanned(segment, "graph configuration");
                    if (!equation.restriction) {
                        equation.restriction = "";
                    }
                    // Desmos allows multiple graph restrictions, so we can just concatenate
                    equation.restriction += `{${segment}}`;
                }
            }
            return equation;
        });
        // console.log(processed, fields);
        return new Dsl(processed, fields);
    }
}

function renderError(err, el) {
    const message = document.createElement("strong");
    message.innerText = "Desmos Graph Error: ";
    const ctx = document.createElement("span");
    ctx.innerText = err;
    const wrapper = document.createElement("div");
    wrapper.appendChild(message);
    wrapper.appendChild(ctx);
    const container = document.createElement("div");
    container.style.padding = "20px";
    container.style.backgroundColor = "#f44336";
    container.style.color = "white";
    container.appendChild(wrapper);
    el.empty();
    el.appendChild(container);
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
            .setDesc("How long to wait after a keypress to render the graph (set to 0 to disable, requires restart to take effect)")
            .addText((text) => text
            .setValue(this.plugin.settings.debounce.toString())
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            const val = parseInt(value);
            this.plugin.settings.debounce =
                Number.isNaN(val) || val < 0
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
            const vault_root = plugin.app.vault.adapter.basePath; // fixme use the vault API instead of the adapter API (`app.vault.getRoot()` returns `/` so not sure how to get the actual root of the vault)
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
                    latex: "${equation.equation.replace("\\", "\\\\")}${
                // interpolation is safe as we ensured the string did not contain any quotes in the parser
                ((_a = equation.restriction) !== null && _a !== void 0 ? _a : "")
                    .replaceAll("{", "\\\\{")
                    .replaceAll("}", "\\\\}")
                    .replaceAll("<=", "\\\\leq ")
                    .replaceAll(">=", "\\\\geq ")
                    .replaceAll("<", "\\\\le ")
                    .replaceAll(">", "\\\\ge ")}",
                    
                    ${(() => {
                    if (equation.style) {
                        if ([
                            EquationStyle.Solid,
                            EquationStyle.Dashed,
                            EquationStyle.Dotted,
                        ].contains(equation.style)) {
                            return `lineStyle: Desmos.Styles.${equation.style},`;
                        }
                        else if ([
                            EquationStyle.Point,
                            EquationStyle.Open,
                            EquationStyle.Cross,
                        ].contains(equation.style)) {
                            return `pointStyle: Desmos.Styles.${equation.style},`;
                        }
                    }
                    return "";
                })()}

                    ${(() => {
                    if (equation.color) {
                        if (isHexColor(equation.color)) {
                            return `color: "${equation.color}",`; // interpolation is safe as we ensured the string was alphanumeric in the parser
                        }
                        else {
                            return `color: Desmos.Colors.${equation.color},`;
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
            <div id="calculator-${hash}" style="width: ${fields.width}px; height: ${fields.height}px;"></div>
            <script>
                const options = {
                    settingsMenu: false,
                    expressions: false,
                    lockViewPort: true,
                    zoomButtons: false,
                    trace: false,
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
            this.skip_debounce = false;
            yield this.loadSettings();
            this.addSettingTab(new SettingsTab(this.app, this));
            // Skip debounce after a layout change
            this.registerEvent(this.app.workspace.on("layout-change", () => (this.skip_debounce = true)));
            this.app.workspace.activeLeaf;
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
                if (this.skip_debounce ||
                    !this.settings.debounce ||
                    this.settings.debounce < 1) {
                    this.skip_debounce = false;
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
