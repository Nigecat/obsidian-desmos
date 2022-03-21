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

/// The maximum dimensions of a graph
const MAX_SIZE = 99999;
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
    EquationColor["RED"] = "#ff0000";
    EquationColor["GREEN"] = "#00ff00";
    EquationColor["BLUE"] = "#0000ff";
    EquationColor["YELLOW"] = "#ffff00";
    EquationColor["MAGENTA"] = "#ff00ff";
    EquationColor["CYAN"] = "#00ffff";
    EquationColor["PURPLE"] = "#cc8899";
    EquationColor["ORANGE"] = "#ffa500";
    EquationColor["BLACK"] = "#000000";
    EquationColor["WHITE"] = "#ffffff";
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
    constructor(equations, fields, potential_error_cause) {
        this.equations = equations;
        this.fields = Object.assign(Object.assign({}, FIELD_DEFAULTS), fields);
        this.potential_error_cause = potential_error_cause;
        Dsl.assert_sanity(this.fields);
        this.hash = crypto.createHash("sha256").update(JSON.stringify(this)).digest("hex");
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
        var _a, _b;
        const split = source.split("---");
        let potential_error_cause;
        let equations;
        let fields = {};
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
                            default: {
                                throw new SyntaxError(`Got unrecognized field type ${field_t} with value ${field_v}, this is a bug.`);
                            }
                            // case "string": {
                            //     this.assert_notbanned(value, `field value for key: '${key}'`);
                            //     (settings as any)[key] = value;
                            //     break;
                            // }
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
            const segments = eq.split("|").map((segment) => segment.trim());
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
                else if (Object.keys(EquationColor).includes(segmentUpperCase) || isHexColor(segment)) {
                    if (!equation.color) {
                        if (isHexColor(segment)) {
                            equation.color = segment;
                        }
                        else {
                            equation.color =
                                Object.values(EquationColor)[Object.keys(EquationColor).indexOf(segmentUpperCase)];
                        }
                    }
                    else {
                        throw new SyntaxError(`Duplicate color identifiers detected: ${equation.color}, ${segmentUpperCase}`);
                    }
                }
                // Otherwise, assume it is a graph restriction
                else {
                    this.assert_notbanned(segment, "graph configuration");
                    if (segment.includes("\\")) {
                        // If the restriction included a `\` (the LaTeX control character) then the user may have tried to use the LaTeX syntax in the graph restriction (e.g `\frac{1}{2}`)
                        //  Desmos does not allow this but returns a fairly archaic error - "A piecewise expression must have at least one condition."
                        potential_error_cause = document.createElement("span");
                        let pre = document.createElement("span");
                        pre.innerHTML = "You may have tried to use the LaTeX syntax in the graph restriction (";
                        let inner = document.createElement("code");
                        inner.innerText = segment;
                        let post = document.createElement("span");
                        post.innerHTML =
                            "), please use some sort of an alternative (e.g <code>\\frac{1}{2}</code> => <code>1/2</code>) as this is not supported by Desmos.";
                        potential_error_cause.appendChild(pre);
                        potential_error_cause.appendChild(inner);
                        potential_error_cause.appendChild(post);
                    }
                    if (!equation.restriction) {
                        equation.restriction = "";
                    }
                    // Desmos allows multiple graph restrictions, so we can just concatenate
                    equation.restriction += `{${segment}}`;
                }
            }
            return equation;
        });
        // Limit the height and width to something reasonable
        if (Math.max((_a = fields.width) !== null && _a !== void 0 ? _a : 0, (_b = fields.height) !== null && _b !== void 0 ? _b : 0) > MAX_SIZE) {
            throw new SyntaxError(`Graph size outside of accepted bounds (${MAX_SIZE}x${MAX_SIZE})`);
        }
        return new Dsl(processed, fields, potential_error_cause);
    }
}

function renderError(err, el, extra) {
    const wrapper = document.createElement("div");
    const message = document.createElement("strong");
    message.innerText = "Desmos Graph Error: ";
    wrapper.appendChild(message);
    const ctx = document.createElement("span");
    ctx.innerText = err;
    wrapper.appendChild(ctx);
    if (extra) {
        const message_extra = document.createElement("strong");
        message_extra.innerHTML = "<br>Note: ";
        wrapper.appendChild(message_extra);
        wrapper.appendChild(extra);
    }
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
    // debounce: 500,
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
        // new Setting(containerEl)
        //     .setName("Debounce Time (ms)")
        //     .setDesc(
        //         "How long to wait after a keypress to render the graph (set to 0 to disable, requires restart to take effect)"
        //     )
        //     .addText((text) =>
        //         text.setValue(this.plugin.settings.debounce.toString()).onChange(async (value) => {
        //             const val = parseInt(value);
        //             this.plugin.settings.debounce =
        //                 Number.isNaN(val) || val < 0 ? DEFAULT_SETTINGS_STATIC.debounce : val;
        //             await this.plugin.saveSettings();
        //         })
        //     );
        new obsidian.Setting(containerEl)
            .setName("Cache")
            .setDesc("Whether to cache the rendered graphs")
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.cache.enabled).onChange((value) => __awaiter(this, void 0, void 0, function* () {
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
                this.plugin.settings.cache.location = value;
                yield this.plugin.saveSettings();
                // Reset the display so the new state can render
                this.display();
            })));
            if (this.plugin.settings.cache.location == CacheLocation.Filesystem) {
                new obsidian.Setting(containerEl)
                    .setName("Cache Directory")
                    .setDesc("The directory to save cached graphs in (technical note: the graphs will be saved as `desmos-graph-<hash>.png` where the name is a SHA-256 hash of the graph source). The default directory is the system tempdir for your current operating system, and this value may be either a path relative to the root of your vault or an absolute path. Also note that a lot of junk will be saved to this folder, you have been warned.")
                    .addText((text) => {
                    var _a;
                    return text
                        .setPlaceholder(os.tmpdir())
                        .setValue((_a = this.plugin.settings.cache.directory) !== null && _a !== void 0 ? _a : "")
                        .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                        this.plugin.settings.cache.directory = value;
                        yield this.plugin.saveSettings();
                    }));
                });
            }
        }
    }
}

class Renderer {
    static render(args, settings, el, plugin) {
        return new Promise((resolve) => {
            const { fields, equations, hash, potential_error_cause } = args;
            // Calculate cache info for filesystem caching
            const vault_root = plugin.app.vault.adapter.basePath; // fixme use the vault API instead of the adapter API (`app.vault.getRoot()` returns `/` so not sure how to get the actual root of the vault)
            const cache_dir = settings.cache.directory
                ? path__default['default'].isAbsolute(settings.cache.directory)
                    ? settings.cache.directory
                    : path__default['default'].join(vault_root, settings.cache.directory)
                : os.tmpdir();
            const cache_target = path__default['default'].join(cache_dir, `desmos-graph-${hash}.png`);
            // If this graph is in the cache then fetch it
            if (settings.cache.enabled) {
                if (settings.cache.location == CacheLocation.Memory && hash in plugin.graph_cache) {
                    const data = plugin.graph_cache[hash];
                    const img = document.createElement("img");
                    img.src = data;
                    el.appendChild(img);
                    resolve();
                    return;
                }
                else if (settings.cache.location == CacheLocation.Filesystem && fs.existsSync(cache_target)) {
                    fs.promises.readFile(cache_target).then((data) => {
                        const b64 = "data:image/png;base64," + Buffer.from(data).toString("base64");
                        const img = document.createElement("img");
                        img.src = b64;
                        el.appendChild(img);
                    });
                    resolve();
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
                        if ([EquationStyle.Solid, EquationStyle.Dashed, EquationStyle.Dotted].contains(equation.style)) {
                            return `lineStyle: Desmos.Styles.${equation.style},`;
                        }
                        else if ([EquationStyle.Point, EquationStyle.Open, EquationStyle.Cross].contains(equation.style)) {
                            return `pointStyle: Desmos.Styles.${equation.style},`;
                        }
                    }
                    return "";
                })()}

                    ${equation.color
                    ? `color: "${equation.color}",` // interpolation is safe as we ensured the string was alphanumeric in the parser
                    : ""}
                });`;
            });
            // Because of the electron sandboxing we have to do this inside an iframe (and regardless this is safer),
            //   otherwise we can't include the desmos API (although it would be nice if they had a REST API of some sort)
            // Interestingly enough, this script functions perfectly fine fully offline - so we could include a vendored copy if need be
            //   (the script gets cached by electron the first time it's used so this isn't a particularly high priority)
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
                            parent.postMessage({ t: "desmos-graph", d: "error", o: "app://obsidian.md", data: analysis.errorMessage, hash: "${hash}" }, "app://obsidian.md");
                        }
                    }
                });

                calculator.asyncScreenshot({ showLabels: true, format: "png" }, (data) => {
                    document.body.innerHTML = "";
                    parent.postMessage({ t: "desmos-graph", d: "render", o: "app://obsidian.md", data, hash: "${hash}" }, "app://obsidian.md");
                });
            </script>
        `;
            const html_src = `<html><head>${html_src_head}</head><body>${html_src_body}</body>`;
            const iframe = document.createElement("iframe");
            iframe.sandbox.add("allow-scripts"); // enable sandbox mode - this prevents any xss exploits from an untrusted source in the frame (and prevents it from accessing the parent)
            iframe.width = fields.width.toString();
            iframe.height = fields.height.toString();
            iframe.style.border = "none";
            iframe.scrolling = "no"; // fixme use a non-depreciated function
            iframe.srcdoc = html_src;
            // iframe.style.display = "none"; // fixme hiding the iframe breaks the positioning
            el.appendChild(iframe);
            const handler = (message) => {
                if (message.data.o === "app://obsidian.md" &&
                    message.data.t === "desmos-graph" &&
                    message.data.hash === hash) {
                    el.empty();
                    if (message.data.d === "error") {
                        renderError(message.data.data, el, potential_error_cause);
                        resolve(); // let caller know we are done rendering
                    }
                    if (message.data.d === "render") {
                        const { data } = message.data;
                        window.removeEventListener("message", handler);
                        const img = document.createElement("img");
                        img.src = data;
                        el.appendChild(img);
                        resolve(); // let caller know we are done rendering
                        if (settings.cache.enabled) {
                            if (settings.cache.location == CacheLocation.Memory) {
                                plugin.graph_cache[hash] = data;
                            }
                            else if (settings.cache.location == CacheLocation.Filesystem) {
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
    constructor() {
        super(...arguments);
        /** Helper for in-memory graph caching */
        this.graph_cache = {};
    }
    onload() {
        // Wait until the settings are loaded before registering anything which relies on it
        this.loadSettings().then(() => {
            this.addSettingTab(new SettingsTab(this.app, this));
            this.registerMarkdownCodeBlockProcessor("desmos-graph", (source, el) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const args = Dsl.parse(source);
                    yield Renderer.render(args, this.settings, el, this);
                }
                catch (err) {
                    if (err instanceof Error) {
                        renderError(err.message, el);
                    }
                    else if (typeof err === "string") {
                        renderError(err, el);
                    }
                    else {
                        renderError("Unexpected error - see console for debug log", el);
                        console.error(err);
                    }
                }
            }));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9kc2wudHMiLCJzcmMvZXJyb3IudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6bnVsbCwibmFtZXMiOlsiY3JlYXRlSGFzaCIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwidG1wZGlyIiwicGF0aCIsImV4aXN0c1N5bmMiLCJmcyIsIk5vdGljZSIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXVEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDdEcsUUFBUSxTQUFTLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUU7QUFDdEgsUUFBUSxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsVUFBVSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDOUUsS0FBSyxDQUFDLENBQUM7QUFDUDs7QUMzRUE7QUFDQSxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUM7QUFXdkIsTUFBTSxjQUFjLEdBQVc7SUFDM0IsS0FBSyxFQUFFLEdBQUc7SUFDVixNQUFNLEVBQUUsR0FBRztJQUNYLElBQUksRUFBRSxDQUFDLEVBQUU7SUFDVCxLQUFLLEVBQUUsRUFBRTtJQUNULE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDVixHQUFHLEVBQUUsQ0FBQztDQUNULENBQUM7QUFTRixJQUFZLGFBT1g7QUFQRCxXQUFZLGFBQWE7SUFDckIsZ0NBQWUsQ0FBQTtJQUNmLGtDQUFpQixDQUFBO0lBQ2pCLGtDQUFpQixDQUFBO0lBQ2pCLGdDQUFlLENBQUE7SUFDZiw4QkFBYSxDQUFBO0lBQ2IsZ0NBQWUsQ0FBQTtBQUNuQixDQUFDLEVBUFcsYUFBYSxLQUFiLGFBQWEsUUFPeEI7QUFFRCxJQUFZLGFBYVg7QUFiRCxXQUFZLGFBQWE7SUFDckIsZ0NBQWUsQ0FBQTtJQUNmLGtDQUFpQixDQUFBO0lBQ2pCLGlDQUFnQixDQUFBO0lBRWhCLG1DQUFrQixDQUFBO0lBQ2xCLG9DQUFtQixDQUFBO0lBQ25CLGlDQUFnQixDQUFBO0lBRWhCLG1DQUFrQixDQUFBO0lBQ2xCLG1DQUFrQixDQUFBO0lBQ2xCLGtDQUFpQixDQUFBO0lBQ2pCLGtDQUFpQixDQUFBO0FBQ3JCLENBQUMsRUFiVyxhQUFhLEtBQWIsYUFBYSxRQWF4QjtTQUllLFVBQVUsQ0FBQyxLQUFhO0lBQ3BDLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUN2QixLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzs7UUFFdkIsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDOUIsT0FBTyxJQUFJLENBQUM7U0FDZjtLQUNKO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDakIsQ0FBQztNQUVZLEdBQUc7SUFRWixZQUFvQixTQUFxQixFQUFFLE1BQXVCLEVBQUUscUJBQXVDO1FBQ3ZHLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO1FBQzNCLElBQUksQ0FBQyxNQUFNLG1DQUFRLGNBQWMsR0FBSyxNQUFNLENBQUUsQ0FBQztRQUMvQyxJQUFJLENBQUMscUJBQXFCLEdBQUcscUJBQXFCLENBQUM7UUFDbkQsR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLElBQUksR0FBR0EsaUJBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUMvRTs7SUFHTyxPQUFPLGFBQWEsQ0FBQyxNQUFjOztRQUV2QyxJQUFJLE1BQU0sQ0FBQyxJQUFJLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRTtZQUM3QixNQUFNLElBQUksV0FBVyxDQUNqQixtQkFBbUIsTUFBTSxDQUFDLEtBQUsseUNBQXlDLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FDekYsQ0FBQztTQUNMO1FBRUQsSUFBSSxNQUFNLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxHQUFHLEVBQUU7WUFDN0IsTUFBTSxJQUFJLFdBQVcsQ0FBQztnQ0FDRixNQUFNLENBQUMsR0FBRywyQ0FBMkMsTUFBTSxDQUFDLE1BQU07YUFDckYsQ0FBQyxDQUFDO1NBQ047S0FDSjs7O0lBSU8sT0FBTyxnQkFBZ0IsQ0FBQyxLQUFhLEVBQUUsR0FBVztRQUN0RCxNQUFNLFdBQVcsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFcEMsS0FBSyxNQUFNLENBQUMsSUFBSSxXQUFXLEVBQUU7WUFDekIsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUNuQixNQUFNLElBQUksV0FBVyxDQUFDLHdCQUF3QixDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUMsQ0FBQzthQUNoRTtTQUNKO0tBQ0o7SUFFTSxPQUFPLEtBQUssQ0FBQyxNQUFjOztRQUM5QixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRWxDLElBQUkscUJBQWtELENBQUM7UUFDdkQsSUFBSSxTQUErQixDQUFDO1FBQ3BDLElBQUksTUFBTSxHQUFvQixFQUFFLENBQUM7UUFDakMsUUFBUSxLQUFLLENBQUMsTUFBTTtZQUNoQixLQUFLLENBQUMsRUFBRTtnQkFDSixTQUFTLEdBQUcsRUFBRSxDQUFDO2dCQUNmLE1BQU07YUFDVDtZQUVELEtBQUssQ0FBQyxFQUFFO2dCQUNKLFNBQVMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDakQsTUFBTTthQUNUO1lBRUQsS0FBSyxDQUFDLEVBQUU7O2dCQUVKLE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDOztxQkFFWixLQUFLLENBQUMsUUFBUSxDQUFDO3FCQUNmLEdBQUcsQ0FBQyxDQUFDLE9BQU8sS0FBSyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7O3FCQUVoQyxNQUFNLENBQUMsT0FBTyxDQUFDOztxQkFFZixHQUFHLENBQUMsQ0FBQyxPQUFPO29CQUNULE1BQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUMzQyxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztpQkFDakMsQ0FBQztxQkFDRCxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDO29CQUMzQixJQUFJLGNBQWMsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQUU7d0JBQ3BDLElBQUksQ0FBQyxLQUFLLEVBQUU7NEJBQ1IsTUFBTSxJQUFJLFdBQVcsQ0FBQyxVQUFVLEdBQUcscUJBQXFCLENBQUMsQ0FBQzt5QkFDN0Q7O3dCQUdELE1BQU0sT0FBTyxHQUFJLGNBQXNCLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBQzdDLE1BQU0sT0FBTyxHQUFHLE9BQU8sT0FBTyxDQUFDO3dCQUMvQixRQUFRLE9BQU87NEJBQ1gsS0FBSyxRQUFRLEVBQUU7Z0NBQ1gsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dDQUMxQixJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUU7b0NBQ2pCLE1BQU0sSUFBSSxXQUFXLENBQUMsVUFBVSxHQUFHLDhCQUE4QixDQUFDLENBQUM7aUNBQ3RFO2dDQUNBLFFBQWdCLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dDQUMzQixNQUFNOzZCQUNUOzRCQUVELFNBQVM7Z0NBQ0wsTUFBTSxJQUFJLFdBQVcsQ0FDakIsK0JBQStCLE9BQU8sZUFBZSxPQUFPLGtCQUFrQixDQUNqRixDQUFDOzZCQUNMOzs7Ozs7Ozs7Ozs7Ozs7eUJBbUJKO3FCQUNKO3lCQUFNO3dCQUNILE1BQU0sSUFBSSxXQUFXLENBQUMsdUJBQXVCLEdBQUcsRUFBRSxDQUFDLENBQUM7cUJBQ3ZEO29CQUVELE9BQU8sUUFBUSxDQUFDO2lCQUNuQixFQUFFLEVBQXFCLENBQUMsQ0FBQztnQkFFOUIsU0FBUyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNqRCxNQUFNO2FBQ1Q7WUFFRCxTQUFTO2dCQUNMLE1BQU0sR0FBRyxFQUFFLENBQUM7YUFDZjtTQUNKO1FBQ0QsSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNaLE1BQU0sSUFBSSxXQUFXLENBQUMsbUJBQW1CLENBQUMsQ0FBQztTQUM5Qzs7UUFHRCxNQUFNLFNBQVMsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtZQUMvQixNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sS0FBSyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQzs7WUFHaEUsTUFBTSxRQUFRLEdBQWEsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLEtBQUssRUFBdUIsRUFBRSxDQUFDO1lBQy9FLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLGdCQUFnQixDQUFDLENBQUM7OztZQUkzRCxLQUFLLE1BQU0sT0FBTyxJQUFJLFFBQVEsRUFBRTtnQkFDNUIsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7O2dCQUcvQyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsUUFBUSxDQUFDLGdCQUFpQyxDQUFDLEVBQUU7b0JBQzFFLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFO3dCQUNqQixRQUFRLENBQUMsS0FBSyxHQUFHLGdCQUFpQyxDQUFDO3FCQUN0RDt5QkFBTTt3QkFDSCxNQUFNLElBQUksV0FBVyxDQUNqQix5Q0FBeUMsUUFBUSxDQUFDLEtBQUssS0FBSyxnQkFBZ0IsRUFBRSxDQUNqRixDQUFDO3FCQUNMO2lCQUNKOztxQkFHSSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFO29CQUNuRixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRTt3QkFDakIsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUU7NEJBQ3JCLFFBQVEsQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDO3lCQUM1Qjs2QkFBTTs0QkFDSCxRQUFRLENBQUMsS0FBSztnQ0FDVixNQUFNLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQzt5QkFDMUY7cUJBQ0o7eUJBQU07d0JBQ0gsTUFBTSxJQUFJLFdBQVcsQ0FDakIseUNBQXlDLFFBQVEsQ0FBQyxLQUFLLEtBQUssZ0JBQWdCLEVBQUUsQ0FDakYsQ0FBQztxQkFDTDtpQkFDSjs7cUJBR0k7b0JBQ0QsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO29CQUV0RCxJQUFLLE9BQWtCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFOzs7d0JBR3BDLHFCQUFxQixHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7d0JBRXZELElBQUksR0FBRyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7d0JBQ3pDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsdUVBQXVFLENBQUM7d0JBRXhGLElBQUksS0FBSyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7d0JBQzNDLEtBQUssQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDO3dCQUUxQixJQUFJLElBQUksR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO3dCQUMxQyxJQUFJLENBQUMsU0FBUzs0QkFDVixtSUFBbUksQ0FBQzt3QkFFeEkscUJBQXFCLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUN2QyxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQ3pDLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDM0M7b0JBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUU7d0JBQ3ZCLFFBQVEsQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO3FCQUM3Qjs7b0JBR0QsUUFBUSxDQUFDLFdBQVcsSUFBSSxJQUFJLE9BQU8sR0FBRyxDQUFDO2lCQUMxQzthQUNKO1lBRUQsT0FBTyxRQUFRLENBQUM7U0FDbkIsQ0FBQyxDQUFDOztRQUdILElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFBLE1BQU0sQ0FBQyxLQUFLLG1DQUFJLENBQUMsRUFBRSxNQUFBLE1BQU0sQ0FBQyxNQUFNLG1DQUFJLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRTtZQUM1RCxNQUFNLElBQUksV0FBVyxDQUFDLDBDQUEwQyxRQUFRLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQztTQUM1RjtRQUVELE9BQU8sSUFBSSxHQUFHLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0tBQzVEOzs7U0M5UlcsV0FBVyxDQUFDLEdBQVcsRUFBRSxFQUFlLEVBQUUsS0FBdUI7SUFDN0UsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUU5QyxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2pELE9BQU8sQ0FBQyxTQUFTLEdBQUcsc0JBQXNCLENBQUM7SUFDM0MsT0FBTyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUU3QixNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzNDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsR0FBRyxDQUFDO0lBQ3BCLE9BQU8sQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7SUFFekIsSUFBSSxLQUFLLEVBQUU7UUFDUCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3ZELGFBQWEsQ0FBQyxTQUFTLEdBQUcsWUFBWSxDQUFDO1FBQ3ZDLE9BQU8sQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDbkMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUM5QjtJQUVELE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEQsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDO0lBQ2pDLFNBQVMsQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQztJQUM1QyxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUM7SUFDaEMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUUvQixFQUFFLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDWCxFQUFFLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQzlCOztBQ3RCQSxJQUFZLGFBR1g7QUFIRCxXQUFZLGFBQWE7SUFDckIsa0NBQWlCLENBQUE7SUFDakIsMENBQXlCLENBQUE7QUFDN0IsQ0FBQyxFQUhXLGFBQWEsS0FBYixhQUFhLFFBR3hCO0FBZ0JELE1BQU0sdUJBQXVCLEdBQThCOztJQUV2RCxLQUFLLEVBQUU7UUFDSCxPQUFPLEVBQUUsSUFBSTtRQUNiLFFBQVEsRUFBRSxhQUFhLENBQUMsTUFBTTtLQUNqQztDQUNKLENBQUM7QUFFRjs7U0FFZ0IsZ0JBQWdCLENBQUMsTUFBYztJQUMzQyx1QkFDSSxPQUFPLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLElBQzdCLHVCQUF1QixFQUM1QjtBQUNOLENBQUM7QUFFRDtTQUNnQixlQUFlLENBQUMsTUFBYyxFQUFFLFFBQWE7O0lBRXpELE9BQU8sUUFBb0IsQ0FBQztBQUNoQyxDQUFDO01BRVksV0FBWSxTQUFRQyx5QkFBZ0I7SUFHN0MsWUFBWSxHQUFRLEVBQUUsTUFBYztRQUNoQyxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0tBQ3hCO0lBRUQsT0FBTztRQUNILElBQUksRUFBRSxXQUFXLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFFM0IsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDOzs7Ozs7Ozs7Ozs7OztRQWdCcEIsSUFBSUMsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7YUFDbkIsT0FBTyxDQUFDLE9BQU8sQ0FBQzthQUNoQixPQUFPLENBQUMsc0NBQXNDLENBQUM7YUFDL0MsU0FBUyxDQUFDLENBQUMsTUFBTSxLQUNkLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFPLEtBQUs7WUFDckUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7WUFDM0MsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDOztZQUdqQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7U0FDbEIsQ0FBQSxDQUFDLENBQ0wsQ0FBQztRQUVOLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRTtZQUNwQyxJQUFJQSxnQkFBTyxDQUFDLFdBQVcsQ0FBQztpQkFDbkIsT0FBTyxDQUFDLGdCQUFnQixDQUFDO2lCQUN6QixPQUFPLENBQUMsd0ZBQXdGLENBQUM7aUJBQ2pHLFdBQVcsQ0FBQyxDQUFDLFFBQVEsS0FDbEIsUUFBUTtpQkFDSCxTQUFTLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUM7aUJBQ3pDLFNBQVMsQ0FBQyxhQUFhLENBQUMsVUFBVSxFQUFFLFlBQVksQ0FBQztpQkFDakQsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUM7aUJBQzdDLFFBQVEsQ0FBQyxDQUFPLEtBQUs7Z0JBQ2xCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsS0FBc0IsQ0FBQztnQkFDN0QsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDOztnQkFHakMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2FBQ2xCLENBQUEsQ0FBQyxDQUNULENBQUM7WUFFTixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLElBQUksYUFBYSxDQUFDLFVBQVUsRUFBRTtnQkFDakUsSUFBSUEsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7cUJBQ25CLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztxQkFDMUIsT0FBTyxDQUNKLGthQUFrYSxDQUNyYTtxQkFDQSxPQUFPLENBQUMsQ0FBQyxJQUFJOztvQkFDVixPQUFBLElBQUk7eUJBQ0MsY0FBYyxDQUFDQyxTQUFNLEVBQUUsQ0FBQzt5QkFDeEIsUUFBUSxDQUFDLE1BQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLFNBQVMsbUNBQUksRUFBRSxDQUFDO3lCQUNwRCxRQUFRLENBQUMsQ0FBTyxLQUFLO3dCQUNsQixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQzt3QkFDN0MsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO3FCQUNwQyxDQUFBLENBQUMsQ0FBQTtpQkFBQSxDQUNULENBQUM7YUFDVDtTQUNKO0tBQ0o7OztNQ2hIUSxRQUFRO0lBQ2pCLE9BQU8sTUFBTSxDQUFDLElBQVMsRUFBRSxRQUFrQixFQUFFLEVBQWUsRUFBRSxNQUFjO1FBQ3hFLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPO1lBQ3ZCLE1BQU0sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxxQkFBcUIsRUFBRSxHQUFHLElBQUksQ0FBQzs7WUFHaEUsTUFBTSxVQUFVLEdBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBZSxDQUFDLFFBQVEsQ0FBQztZQUM5RCxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLFNBQVM7a0JBQ3BDQyx3QkFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQztzQkFDckMsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTO3NCQUN4QkEsd0JBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDO2tCQUNuREQsU0FBTSxFQUFFLENBQUM7WUFDZixNQUFNLFlBQVksR0FBR0Msd0JBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLGdCQUFnQixJQUFJLE1BQU0sQ0FBQyxDQUFDOztZQUd0RSxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFO2dCQUN4QixJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxJQUFJLGFBQWEsQ0FBQyxNQUFNLElBQUksSUFBSSxJQUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUU7b0JBQy9FLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ3RDLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQzFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO29CQUNmLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ3BCLE9BQU8sRUFBRSxDQUFDO29CQUNWLE9BQU87aUJBQ1Y7cUJBQU0sSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLFFBQVEsSUFBSSxhQUFhLENBQUMsVUFBVSxJQUFJQyxhQUFVLENBQUMsWUFBWSxDQUFDLEVBQUU7b0JBQ3hGQyxXQUFFLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUk7d0JBQ2hDLE1BQU0sR0FBRyxHQUFHLHdCQUF3QixHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO3dCQUM1RSxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUMxQyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQzt3QkFDZCxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO3FCQUN2QixDQUFDLENBQUM7b0JBQ0gsT0FBTyxFQUFFLENBQUM7b0JBQ1YsT0FBTztpQkFDVjthQUNKO1lBRUQsTUFBTSxXQUFXLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FDN0IsQ0FBQyxRQUFROztnQkFDTCxPQUFBOzhCQUNVLFFBQVEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUM7O2dCQUU3QyxDQUFDLE1BQUEsUUFBUSxDQUFDLFdBQVcsbUNBQUksRUFBRTtxQkFDdEIsVUFBVSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUM7cUJBQ3hCLFVBQVUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDO3FCQUN4QixVQUFVLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQztxQkFDNUIsVUFBVSxDQUFDLElBQUksRUFBRSxVQUFVLENBQUM7cUJBQzVCLFVBQVUsQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDO3FCQUMxQixVQUFVLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FDbEM7O3NCQUVFLENBQUM7b0JBQ0MsSUFBSSxRQUFRLENBQUMsS0FBSyxFQUFFO3dCQUNoQixJQUNJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxhQUFhLENBQUMsTUFBTSxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQ3RFLFFBQVEsQ0FBQyxLQUFLLENBQ2pCLEVBQ0g7NEJBQ0UsT0FBTyw0QkFBNEIsUUFBUSxDQUFDLEtBQUssR0FBRyxDQUFDO3lCQUN4RDs2QkFBTSxJQUNILENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxhQUFhLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUN6Rjs0QkFDRSxPQUFPLDZCQUE2QixRQUFRLENBQUMsS0FBSyxHQUFHLENBQUM7eUJBQ3pEO3FCQUNKO29CQUVELE9BQU8sRUFBRSxDQUFDO2lCQUNiLEdBQUc7O3NCQUdBLFFBQVEsQ0FBQyxLQUFLO3NCQUNSLFdBQVcsUUFBUSxDQUFDLEtBQUssSUFBSTtzQkFDN0IsRUFDVjtvQkFDQSxDQUFBO2FBQUEsQ0FDUCxDQUFDOzs7OztZQU1GLE1BQU0sYUFBYSxHQUFHLCtHQUErRyxDQUFDO1lBQ3RJLE1BQU0sYUFBYSxHQUFHO2tDQUNBLElBQUksbUJBQW1CLE1BQU0sQ0FBQyxLQUFLLGVBQWUsTUFBTSxDQUFDLE1BQU07Ozs7Ozs7Ozs7bUdBVUUsSUFBSTs7NEJBRTNFLE1BQU0sQ0FBQyxJQUFJOzZCQUNWLE1BQU0sQ0FBQyxLQUFLOzJCQUNkLE1BQU0sQ0FBQyxHQUFHOzhCQUNQLE1BQU0sQ0FBQyxNQUFNOzs7a0JBR3pCLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDOzs7Ozs7OElBTXdHLElBQUk7Ozs7Ozs7Z0hBT2xDLElBQUk7OztTQUczRyxDQUFDO1lBQ0UsTUFBTSxRQUFRLEdBQUcsZUFBZSxhQUFhLGdCQUFnQixhQUFhLFNBQVMsQ0FBQztZQUVwRixNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2hELE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3BDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN2QyxNQUFNLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDekMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ3hCLE1BQU0sQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDOztZQUd6QixFQUFFLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRXZCLE1BQU0sT0FBTyxHQUFHLENBQ1osT0FNRTtnQkFFRixJQUNJLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLG1CQUFtQjtvQkFDdEMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssY0FBYztvQkFDakMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUM1QjtvQkFDRSxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBRVgsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxPQUFPLEVBQUU7d0JBQzVCLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUscUJBQXFCLENBQUMsQ0FBQzt3QkFDMUQsT0FBTyxFQUFFLENBQUM7cUJBQ2I7b0JBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxRQUFRLEVBQUU7d0JBQzdCLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDO3dCQUM5QixNQUFNLENBQUMsbUJBQW1CLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO3dCQUUvQyxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUMxQyxHQUFHLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQzt3QkFDZixFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUNwQixPQUFPLEVBQUUsQ0FBQzt3QkFFVixJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFOzRCQUN4QixJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxJQUFJLGFBQWEsQ0FBQyxNQUFNLEVBQUU7Z0NBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDOzZCQUNuQztpQ0FBTSxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxJQUFJLGFBQWEsQ0FBQyxVQUFVLEVBQUU7Z0NBQzVELElBQUlELGFBQVUsQ0FBQyxTQUFTLENBQUMsRUFBRTtvQ0FDdkJDLFdBQUUsQ0FBQyxTQUFTLENBQ1IsWUFBWSxFQUNaLElBQUksQ0FBQyxPQUFPLENBQUMsMEJBQTBCLEVBQUUsRUFBRSxDQUFDLEVBQzVDLFFBQVEsQ0FDWCxDQUFDLEtBQUssQ0FDSCxDQUFDLEdBQUcsS0FDQSxJQUFJQyxlQUFNLENBQ04sOERBQThELEdBQUcsRUFBRSxFQUNuRSxLQUFLLENBQ1IsQ0FDUixDQUFDO2lDQUNMO3FDQUFNO29DQUNILElBQUlBLGVBQU0sQ0FBQyw2Q0FBNkMsU0FBUyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7aUNBQ2hGOzZCQUNKO3lCQUNKO3FCQUNKO2lCQUNKO2FBQ0osQ0FBQztZQUVGLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDL0MsQ0FBQyxDQUFDO0tBQ047OztNQzdMZ0IsTUFBTyxTQUFRQyxlQUFNO0lBQTFDOzs7UUFJSSxnQkFBVyxHQUEyQixFQUFFLENBQUM7S0EwQzVDO0lBeENHLE1BQU07O1FBRUYsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLElBQUksQ0FBQztZQUNyQixJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUVwRCxJQUFJLENBQUMsa0NBQWtDLENBQUMsY0FBYyxFQUFFLENBQU8sTUFBTSxFQUFFLEVBQUU7Z0JBQ3JFLElBQUk7b0JBQ0EsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDL0IsTUFBTSxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztpQkFDeEQ7Z0JBQUMsT0FBTyxHQUFHLEVBQUU7b0JBQ1YsSUFBSSxHQUFHLFlBQVksS0FBSyxFQUFFO3dCQUN0QixXQUFXLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztxQkFDaEM7eUJBQU0sSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQUU7d0JBQ2hDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7cUJBQ3hCO3lCQUFNO3dCQUNILFdBQVcsQ0FBQyw4Q0FBOEMsRUFBRSxFQUFFLENBQUMsQ0FBQzt3QkFDaEUsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztxQkFDdEI7aUJBQ0o7YUFDSixDQUFBLENBQUMsQ0FBQztTQUNOLENBQUMsQ0FBQztLQUNOO0lBRUssWUFBWTs7WUFDZCxJQUFJLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUVyQyxJQUFJLENBQUMsUUFBUSxFQUFFO2dCQUNYLFFBQVEsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNyQztZQUVELElBQUksUUFBUSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRTtnQkFDM0MsUUFBUSxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7YUFDOUM7WUFFRCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztTQUM1QjtLQUFBO0lBRUssWUFBWTs7WUFDZCxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ3RDO0tBQUE7Ozs7OyJ9
