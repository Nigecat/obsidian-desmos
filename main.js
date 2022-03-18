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
                    latex: "${equation.equation.replace("\\", "\\\\")}${((_a = equation.restriction) !== null && _a !== void 0 ? _a : "")
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
