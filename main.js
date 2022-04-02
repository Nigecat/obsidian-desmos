'use strict';

var obsidian = require('obsidian');

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
    grid: true,
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
    constructor(equations, fields, potentialErrorCause) {
        this.equations = equations;
        // Dynamically adjust graph boundary if the defaults would cause an invalid graph with the fields supplied by the user
        // todo there should be a better way of doing this
        const defaultGraphWidth = Math.abs(FIELD_DEFAULTS.left) + Math.abs(FIELD_DEFAULTS.right);
        const defaultGraphHeight = Math.abs(FIELD_DEFAULTS.bottom) + Math.abs(FIELD_DEFAULTS.top);
        if (fields.left !== undefined && fields.right === undefined && fields.left >= FIELD_DEFAULTS.right) {
            fields.right = fields.left + defaultGraphWidth;
        }
        if (fields.left === undefined && fields.right !== undefined && fields.right <= FIELD_DEFAULTS.left) {
            fields.left = fields.right - defaultGraphWidth;
        }
        if (fields.bottom !== undefined && fields.top === undefined && fields.bottom >= FIELD_DEFAULTS.top) {
            fields.top = fields.bottom + defaultGraphHeight;
        }
        if (fields.bottom === undefined && fields.top !== undefined && fields.top <= FIELD_DEFAULTS.bottom) {
            fields.bottom = fields.top - defaultGraphHeight;
        }
        this.fields = Object.assign(Object.assign({}, FIELD_DEFAULTS), fields);
        this.potentialErrorCause = potentialErrorCause;
        Dsl.assertSanity(this.fields);
    }
    /** Get a (hex) SHA-256 hash of this object */
    hash() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._hash) {
                return this._hash;
            }
            const data = new TextEncoder().encode(JSON.stringify(this));
            const buffer = yield crypto.subtle.digest("SHA-256", data);
            const raw = Array.from(new Uint8Array(buffer));
            this._hash = raw.map((b) => b.toString(16).padStart(2, "0")).join(""); // convert binary hash to hex
            return this._hash;
        });
    }
    /** Check if the fields are sane, throws a `SyntaxError` if they aren't */
    static assertSanity(fields) {
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
    /** Assert if a string is safe to interpolate in a string wrapped by '`' (without any escaping vulnerabilities),
     *      throws a `SyntaxError` if they aren't.
     */
    static assertSafeToInterpolate(str, ctx) {
        if (str.includes("`")) {
            if (ctx) {
                throw new SyntaxError(`Illegal character (\`) found in ${ctx ? ctx.replace("?", str) : "string"}`);
            }
        }
    }
    static parse(source) {
        var _a, _b;
        const split = source.split("---");
        let potentialErrorCause;
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
                    // Trim each field, this allows the user to put spaces around the key of a value if they wish
                    return [key.trim(), value.join("=").trim()];
                })
                    .reduce((settings, [k, value]) => {
                    const key = k.toLowerCase();
                    if (key in FIELD_DEFAULTS) {
                        // We can use the defaults to determine the type of each field
                        const fieldValue = FIELD_DEFAULTS[key];
                        const fieldType = typeof fieldValue;
                        // Sanity check
                        Dsl.assertSafeToInterpolate(value, `field '${key}': ?`);
                        // Boolean fields default to `true`
                        if (fieldType !== "boolean" && !value) {
                            throw new SyntaxError(`Field '${key}' must have a value`);
                        }
                        switch (fieldType) {
                            case "number": {
                                const s = parseFloat(value);
                                if (Number.isNaN(s)) {
                                    throw new SyntaxError(`Field '${key}' must have an integer value`);
                                }
                                settings[key] = s;
                                break;
                            }
                            case "boolean": {
                                if (!value) {
                                    settings[key] = true;
                                }
                                else {
                                    if (!["true", "false"].includes(value.toLowerCase())) {
                                        throw new SyntaxError(`Field '${key}' requres a boolean value 'true'/'false' (omit a value to default to 'true')`);
                                    }
                                    settings[key] = value.toLowerCase() === "true" ? true : false;
                                }
                                break;
                            }
                            default: {
                                throw new SyntaxError(`Got unrecognized field type ${fieldType} with value ${fieldValue}, this is a bug.`);
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
        // Process equations
        const processed = equations.map((eq) => {
            const segments = eq.split("|").map((segment) => segment.trim());
            // First segment is always the equation
            const equation = { equation: segments.shift() };
            // Sanity check
            Dsl.assertSafeToInterpolate(equation.equation, `equation: ?`);
            // The rest of the segments can either be the restriction, style, or color
            //  whilst we recommend putting the restriction first, we accept these in any order.
            for (const segment of segments) {
                const segmentUpperCase = segment.toUpperCase();
                // Sanity check
                Dsl.assertSafeToInterpolate(segment, `segment: ?`);
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
                    if (segment.includes("\\")) {
                        // If the restriction included a `\` (the LaTeX control character) then the user may have tried to use the LaTeX syntax in the graph restriction (e.g `\frac{1}{2}`)
                        //  Desmos does not allow this but returns a fairly archaic error - "A piecewise expression must have at least one condition."
                        potentialErrorCause = document.createElement("span");
                        const pre = document.createElement("span");
                        pre.innerHTML = "You may have tried to use the LaTeX syntax in the graph restriction (";
                        const inner = document.createElement("code");
                        inner.innerText = segment;
                        const post = document.createElement("span");
                        post.innerHTML =
                            "), please use some sort of an alternative (e.g <code>\\frac{1}{2}</code> => <code>1/2</code>) as this is not supported by Desmos.";
                        potentialErrorCause.appendChild(pre);
                        potentialErrorCause.appendChild(inner);
                        potentialErrorCause.appendChild(post);
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
        return new Dsl(processed, fields, potentialErrorCause);
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
        const messageExtra = document.createElement("strong");
        messageExtra.innerHTML = "<br>Note: ";
        wrapper.appendChild(messageExtra);
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
/** Get the default settings for the given plugin. This simply uses `DEFAULT_SETTINGS_STATIC` and patches the version from the manifest. */
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
        const { containerEl } = this;
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
            if (this.plugin.settings.cache.location === CacheLocation.Filesystem) {
                new obsidian.Setting(containerEl)
                    .setName("Cache Directory")
                    .setDesc(`The directory to save cached graphs in, relative to the vault root (technical note: the graphs will be saved as \`desmos-graph-<hash>.png\` where the name is a SHA-256 hash of the graph source). Also note that a lot of junk will be saved to this folder, you have been warned.`)
                    .addText((text) => {
                    var _a;
                    text.setValue((_a = this.plugin.settings.cache.directory) !== null && _a !== void 0 ? _a : "").onChange((value) => __awaiter(this, void 0, void 0, function* () {
                        this.plugin.settings.cache.directory = value;
                        yield this.plugin.saveSettings();
                    }));
                });
            }
        }
    }
}

class Renderer {
    constructor(plugin) {
        /** The set of graphs we are currently rendering, mapped by their hash */
        this.rendering = new Map();
        this.plugin = plugin;
        this.active = false;
    }
    activate() {
        if (!this.active) {
            window.addEventListener("message", this.handler.bind(this));
            this.active = true;
        }
    }
    deactivate() {
        if (this.active) {
            window.removeEventListener("message", this.handler.bind(this));
            this.active = false;
        }
    }
    render(args, el) {
        return __awaiter(this, void 0, void 0, function* () {
            const plugin = this.plugin;
            const settings = plugin.settings;
            const { fields, equations } = args;
            const hash = yield args.hash();
            let cacheFile;
            // If this graph is in the cache then fetch it
            if (settings.cache.enabled) {
                if (settings.cache.location === CacheLocation.Memory && hash in plugin.graphCache) {
                    const data = plugin.graphCache[hash];
                    const img = document.createElement("img");
                    img.src = data;
                    el.appendChild(img);
                    return;
                }
                else if (settings.cache.location === CacheLocation.Filesystem && settings.cache.directory) {
                    const adapter = plugin.app.vault.adapter;
                    cacheFile = obsidian.normalizePath(`${settings.cache.directory}/desmos-graph-${hash}.png`);
                    // If this graph is in the cache
                    if (yield adapter.exists(cacheFile)) {
                        const img = document.createElement("img");
                        img.src = adapter.getResourcePath(cacheFile);
                        el.appendChild(img);
                        return;
                    }
                }
            }
            const expressions = equations.map((equation) => {
                var _a;
                return `calculator.setExpression({
                    latex: \`${equation.equation.replace("\\", "\\\\")}${
                // interpolation is safe as we ensured the string did not contain any quotes in the parser
                ((_a = equation.restriction) !== null && _a !== void 0 ? _a : "")
                    .replaceAll("{", "\\\\{")
                    .replaceAll("}", "\\\\}")
                    .replaceAll("<=", "\\\\leq ")
                    .replaceAll(">=", "\\\\geq ")
                    .replaceAll("<", "\\\\le ")
                    .replaceAll(">", "\\\\ge ")}\`,

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
                    ? `color: \`${equation.color}\`,` // interpolation is safe as we ensured the string was alphanumeric in the parser
                    : ""}
                });`;
            });
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

                // Desmos returns an error if we try to observe the expressions without any defined
                if (${expressions.length > 0}) {
                    calculator.observe("expressionAnalysis", () => {
                        for (const id in calculator.expressionAnalysis) {
                            const analysis = calculator.expressionAnalysis[id];
                            if (analysis.isError) {
                                parent.postMessage({ t: "desmos-graph", d: "error", o: "${window.origin}", data: analysis.errorMessage, hash: "${hash}" }, "${window.origin}");
                            }
                        }
                    });
                }

                calculator.asyncScreenshot({ showLabels: true, format: "png" }, (data) => {
                    document.body.innerHTML = "";
                    parent.postMessage({ t: "desmos-graph", d: "render", o: "${window.origin}", data, hash: "${hash}" }, "${window.origin}");
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
            return new Promise((resolve) => this.rendering.set(hash, { args, el, resolve, cacheFile }));
        });
    }
    handler(message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (message.data.o === window.origin && message.data.t === "desmos-graph") {
                const state = this.rendering.get(message.data.hash);
                if (state) {
                    const { args, el, resolve, cacheFile } = state;
                    el.empty();
                    if (message.data.d === "error") {
                        renderError(message.data.data, el, args.potentialErrorCause);
                        resolve(); // let caller know we are done rendering
                    }
                    else if (message.data.d === "render") {
                        const { data } = message.data;
                        const img = document.createElement("img");
                        img.src = data;
                        el.appendChild(img);
                        resolve(); // let caller know we are done rendering
                        const plugin = this.plugin;
                        const settings = plugin.settings;
                        const hash = yield args.hash();
                        if (settings.cache.enabled) {
                            if (settings.cache.location === CacheLocation.Memory) {
                                plugin.graphCache[hash] = data;
                            }
                            else if (settings.cache.location === CacheLocation.Filesystem) {
                                const adapter = plugin.app.vault.adapter;
                                if (cacheFile && settings.cache.directory) {
                                    if (yield adapter.exists(settings.cache.directory)) {
                                        const buffer = Buffer.from(data.replace(/^data:image\/png;base64,/, ""), "base64");
                                        yield adapter.writeBinary(cacheFile, buffer);
                                    }
                                    else {
                                        // tslint:disable-next-line:no-unused-expression
                                        new obsidian.Notice(`desmos-graph: target cache directory '${settings.cache.directory}' does not exist, skipping cache`, 10000);
                                    }
                                }
                                else {
                                    // tslint:disable-next-line:no-unused-expression
                                    new obsidian.Notice(`desmos-graph: filesystem caching enabled but no cache directory set, skipping cache`, 10000);
                                }
                            }
                        }
                    }
                    this.rendering.delete(message.data.hash);
                }
                else {
                    // do nothing if graph is not in render list (this should not happen)
                    console.warn(`Got graph not in render list, this is probably a bug - ${JSON.stringify(this.rendering)}`);
                }
            }
        });
    }
}

class Desmos extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        /** Helper for in-memory graph caching */
        this.graphCache = {};
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            this.renderer = new Renderer(this);
            this.renderer.activate();
            this.addSettingTab(new SettingsTab(this.app, this));
            this.registerMarkdownCodeBlockProcessor("desmos-graph", (source, el) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const args = Dsl.parse(source);
                    yield this.renderer.render(args, el);
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
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            this.renderer.deactivate();
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            let settings = yield this.loadData();
            if (!settings) {
                settings = DEFAULT_SETTINGS(this);
            }
            if (settings.version !== this.manifest.version) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9kc2wudHMiLCJzcmMvZXJyb3IudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXHJcblxyXG5QZXJtaXNzaW9uIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBhbmQvb3IgZGlzdHJpYnV0ZSB0aGlzIHNvZnR3YXJlIGZvciBhbnlcclxucHVycG9zZSB3aXRoIG9yIHdpdGhvdXQgZmVlIGlzIGhlcmVieSBncmFudGVkLlxyXG5cclxuVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiBBTkQgVEhFIEFVVEhPUiBESVNDTEFJTVMgQUxMIFdBUlJBTlRJRVMgV0lUSFxyXG5SRUdBUkQgVE8gVEhJUyBTT0ZUV0FSRSBJTkNMVURJTkcgQUxMIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFlcclxuQU5EIEZJVE5FU1MuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1IgQkUgTElBQkxFIEZPUiBBTlkgU1BFQ0lBTCwgRElSRUNULFxyXG5JTkRJUkVDVCwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIE9SIEFOWSBEQU1BR0VTIFdIQVRTT0VWRVIgUkVTVUxUSU5HIEZST01cclxuTE9TUyBPRiBVU0UsIERBVEEgT1IgUFJPRklUUywgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIE5FR0xJR0VOQ0UgT1JcclxuT1RIRVIgVE9SVElPVVMgQUNUSU9OLCBBUklTSU5HIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFVTRSBPUlxyXG5QRVJGT1JNQU5DRSBPRiBUSElTIFNPRlRXQVJFLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG4vKiBnbG9iYWwgUmVmbGVjdCwgUHJvbWlzZSAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSkge1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0Lm1ldGFkYXRhID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBSZWZsZWN0Lm1ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXRlcih0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2dlbmVyYXRvcih0aGlzQXJnLCBib2R5KSB7XHJcbiAgICB2YXIgXyA9IHsgbGFiZWw6IDAsIHNlbnQ6IGZ1bmN0aW9uKCkgeyBpZiAodFswXSAmIDEpIHRocm93IHRbMV07IHJldHVybiB0WzFdOyB9LCB0cnlzOiBbXSwgb3BzOiBbXSB9LCBmLCB5LCB0LCBnO1xyXG4gICAgcmV0dXJuIGcgPSB7IG5leHQ6IHZlcmIoMCksIFwidGhyb3dcIjogdmVyYigxKSwgXCJyZXR1cm5cIjogdmVyYigyKSB9LCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKF8pIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChmID0gMSwgeSAmJiAodCA9IG9wWzBdICYgMiA/IHlbXCJyZXR1cm5cIl0gOiBvcFswXSA/IHlbXCJ0aHJvd1wiXSB8fCAoKHQgPSB5W1wicmV0dXJuXCJdKSAmJiB0LmNhbGwoeSksIDApIDogeS5uZXh0KSAmJiAhKHQgPSB0LmNhbGwoeSwgb3BbMV0pKS5kb25lKSByZXR1cm4gdDtcclxuICAgICAgICAgICAgaWYgKHkgPSAwLCB0KSBvcCA9IFtvcFswXSAmIDIsIHQudmFsdWVdO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKG9wWzBdKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDA6IGNhc2UgMTogdCA9IG9wOyBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgNDogXy5sYWJlbCsrOyByZXR1cm4geyB2YWx1ZTogb3BbMV0sIGRvbmU6IGZhbHNlIH07XHJcbiAgICAgICAgICAgICAgICBjYXNlIDU6IF8ubGFiZWwrKzsgeSA9IG9wWzFdOyBvcCA9IFswXTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDc6IG9wID0gXy5vcHMucG9wKCk7IF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghKHQgPSBfLnRyeXMsIHQgPSB0Lmxlbmd0aCA+IDAgJiYgdFt0Lmxlbmd0aCAtIDFdKSAmJiAob3BbMF0gPT09IDYgfHwgb3BbMF0gPT09IDIpKSB7IF8gPSAwOyBjb250aW51ZTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gMyAmJiAoIXQgfHwgKG9wWzFdID4gdFswXSAmJiBvcFsxXSA8IHRbM10pKSkgeyBfLmxhYmVsID0gb3BbMV07IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSA2ICYmIF8ubGFiZWwgPCB0WzFdKSB7IF8ubGFiZWwgPSB0WzFdOyB0ID0gb3A7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHQgJiYgXy5sYWJlbCA8IHRbMl0pIHsgXy5sYWJlbCA9IHRbMl07IF8ub3BzLnB1c2gob3ApOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0WzJdKSBfLm9wcy5wb3AoKTtcclxuICAgICAgICAgICAgICAgICAgICBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG9wID0gYm9keS5jYWxsKHRoaXNBcmcsIF8pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgb3AgPSBbNiwgZV07IHkgPSAwOyB9IGZpbmFsbHkgeyBmID0gdCA9IDA7IH1cclxuICAgICAgICBpZiAob3BbMF0gJiA1KSB0aHJvdyBvcFsxXTsgcmV0dXJuIHsgdmFsdWU6IG9wWzBdID8gb3BbMV0gOiB2b2lkIDAsIGRvbmU6IHRydWUgfTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2NyZWF0ZUJpbmRpbmcgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIGsyLCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH0pO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IGZyb20pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpZiAoZ1tuXSkgaVtuXSA9IGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAoYSwgYikgeyBxLnB1c2goW24sIHYsIGEsIGJdKSA+IDEgfHwgcmVzdW1lKG4sIHYpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IG4gPT09IFwicmV0dXJuXCIgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0U3Rhcihtb2QpIHtcclxuICAgIGlmIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpIHJldHVybiBtb2Q7XHJcbiAgICB2YXIgcmVzdWx0ID0ge307XHJcbiAgICBpZiAobW9kICE9IG51bGwpIGZvciAodmFyIGsgaW4gbW9kKSBpZiAoayAhPT0gXCJkZWZhdWx0XCIgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG1vZCwgaykpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwgayk7XHJcbiAgICBfX3NldE1vZHVsZURlZmF1bHQocmVzdWx0LCBtb2QpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0RGVmYXVsdChtb2QpIHtcclxuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgZGVmYXVsdDogbW9kIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XHJcbn1cclxuIiwiLy8vIFRoZSBtYXhpbXVtIGRpbWVuc2lvbnMgb2YgYSBncmFwaFxuY29uc3QgTUFYX1NJWkUgPSA5OTk5OTtcblxuZXhwb3J0IGludGVyZmFjZSBGaWVsZHMge1xuICAgIHdpZHRoOiBudW1iZXI7XG4gICAgaGVpZ2h0OiBudW1iZXI7XG4gICAgbGVmdDogbnVtYmVyO1xuICAgIHJpZ2h0OiBudW1iZXI7XG4gICAgYm90dG9tOiBudW1iZXI7XG4gICAgdG9wOiBudW1iZXI7XG4gICAgZ3JpZDogYm9vbGVhbjtcbn1cblxuY29uc3QgRklFTERfREVGQVVMVFM6IEZpZWxkcyA9IHtcbiAgICB3aWR0aDogNjAwLFxuICAgIGhlaWdodDogNDAwLFxuICAgIGxlZnQ6IC0xMCxcbiAgICByaWdodDogMTAsXG4gICAgYm90dG9tOiAtNyxcbiAgICB0b3A6IDcsXG4gICAgZ3JpZDogdHJ1ZSxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXF1YXRpb24ge1xuICAgIGVxdWF0aW9uOiBzdHJpbmc7XG4gICAgcmVzdHJpY3Rpb24/OiBzdHJpbmc7XG4gICAgc3R5bGU/OiBFcXVhdGlvblN0eWxlO1xuICAgIGNvbG9yPzogRXF1YXRpb25Db2xvciB8IEhleENvbG9yO1xufVxuXG5leHBvcnQgZW51bSBFcXVhdGlvblN0eWxlIHtcbiAgICBTb2xpZCA9IFwiU09MSURcIixcbiAgICBEYXNoZWQgPSBcIkRBU0hFRFwiLFxuICAgIERvdHRlZCA9IFwiRE9UVEVEXCIsXG4gICAgUG9pbnQgPSBcIlBPSU5UXCIsXG4gICAgT3BlbiA9IFwiT1BFTlwiLFxuICAgIENyb3NzID0gXCJDUk9TU1wiLFxufVxuXG5leHBvcnQgZW51bSBFcXVhdGlvbkNvbG9yIHtcbiAgICBSRUQgPSBcIiNmZjAwMDBcIixcbiAgICBHUkVFTiA9IFwiIzAwZmYwMFwiLFxuICAgIEJMVUUgPSBcIiMwMDAwZmZcIixcblxuICAgIFlFTExPVyA9IFwiI2ZmZmYwMFwiLFxuICAgIE1BR0VOVEEgPSBcIiNmZjAwZmZcIixcbiAgICBDWUFOID0gXCIjMDBmZmZmXCIsXG5cbiAgICBQVVJQTEUgPSBcIiNjYzg4OTlcIixcbiAgICBPUkFOR0UgPSBcIiNmZmE1MDBcIixcbiAgICBCTEFDSyA9IFwiIzAwMDAwMFwiLFxuICAgIFdISVRFID0gXCIjZmZmZmZmXCIsXG59XG5cbmV4cG9ydCB0eXBlIEhleENvbG9yID0gc3RyaW5nO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNIZXhDb2xvcih2YWx1ZTogc3RyaW5nKTogdmFsdWUgaXMgSGV4Q29sb3Ige1xuICAgIGlmICh2YWx1ZS5zdGFydHNXaXRoKFwiI1wiKSkge1xuICAgICAgICB2YWx1ZSA9IHZhbHVlLnNsaWNlKDEpO1xuICAgICAgICAvLyBFbnN1cmUgdGhlIHJlc3Qgb2YgdGhlIHZhbHVlIGlzIGEgdmFsaWQgYWxwaGFudW1lcmljIHN0cmluZ1xuICAgICAgICBpZiAoL15bMC05YS16QS1aXSskLy50ZXN0KHZhbHVlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBjbGFzcyBEc2wge1xuICAgIHByaXZhdGUgX2hhc2g/OiBzdHJpbmc7XG4gICAgcHVibGljIHJlYWRvbmx5IGVxdWF0aW9uczogRXF1YXRpb25bXTtcbiAgICBwdWJsaWMgcmVhZG9ubHkgZmllbGRzOiBGaWVsZHM7XG4gICAgLyoqICBTdXBwbGVtZW50YXJ5IGVycm9yIGluZm9ybWF0aW9uIGlmIHRoZSBzb3VyY2UgaWYgdmFsaWQgYnV0IERlc21vcyByZXR1cm5zIGFuIGVycm9yICovXG4gICAgcHVibGljIHJlYWRvbmx5IHBvdGVudGlhbEVycm9yQ2F1c2U/OiBIVE1MU3BhbkVsZW1lbnQ7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKGVxdWF0aW9uczogRXF1YXRpb25bXSwgZmllbGRzOiBQYXJ0aWFsPEZpZWxkcz4sIHBvdGVudGlhbEVycm9yQ2F1c2U/OiBIVE1MU3BhbkVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5lcXVhdGlvbnMgPSBlcXVhdGlvbnM7XG5cbiAgICAgICAgLy8gRHluYW1pY2FsbHkgYWRqdXN0IGdyYXBoIGJvdW5kYXJ5IGlmIHRoZSBkZWZhdWx0cyB3b3VsZCBjYXVzZSBhbiBpbnZhbGlkIGdyYXBoIHdpdGggdGhlIGZpZWxkcyBzdXBwbGllZCBieSB0aGUgdXNlclxuICAgICAgICAvLyB0b2RvIHRoZXJlIHNob3VsZCBiZSBhIGJldHRlciB3YXkgb2YgZG9pbmcgdGhpc1xuICAgICAgICBjb25zdCBkZWZhdWx0R3JhcGhXaWR0aCA9IE1hdGguYWJzKEZJRUxEX0RFRkFVTFRTLmxlZnQpICsgTWF0aC5hYnMoRklFTERfREVGQVVMVFMucmlnaHQpO1xuICAgICAgICBjb25zdCBkZWZhdWx0R3JhcGhIZWlnaHQgPSBNYXRoLmFicyhGSUVMRF9ERUZBVUxUUy5ib3R0b20pICsgTWF0aC5hYnMoRklFTERfREVGQVVMVFMudG9wKTtcbiAgICAgICAgaWYgKGZpZWxkcy5sZWZ0ICE9PSB1bmRlZmluZWQgJiYgZmllbGRzLnJpZ2h0ID09PSB1bmRlZmluZWQgJiYgZmllbGRzLmxlZnQgPj0gRklFTERfREVGQVVMVFMucmlnaHQpIHtcbiAgICAgICAgICAgIGZpZWxkcy5yaWdodCA9IGZpZWxkcy5sZWZ0ICsgZGVmYXVsdEdyYXBoV2lkdGg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZpZWxkcy5sZWZ0ID09PSB1bmRlZmluZWQgJiYgZmllbGRzLnJpZ2h0ICE9PSB1bmRlZmluZWQgJiYgZmllbGRzLnJpZ2h0IDw9IEZJRUxEX0RFRkFVTFRTLmxlZnQpIHtcbiAgICAgICAgICAgIGZpZWxkcy5sZWZ0ID0gZmllbGRzLnJpZ2h0IC0gZGVmYXVsdEdyYXBoV2lkdGg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZpZWxkcy5ib3R0b20gIT09IHVuZGVmaW5lZCAmJiBmaWVsZHMudG9wID09PSB1bmRlZmluZWQgJiYgZmllbGRzLmJvdHRvbSA+PSBGSUVMRF9ERUZBVUxUUy50b3ApIHtcbiAgICAgICAgICAgIGZpZWxkcy50b3AgPSBmaWVsZHMuYm90dG9tICsgZGVmYXVsdEdyYXBoSGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChmaWVsZHMuYm90dG9tID09PSB1bmRlZmluZWQgJiYgZmllbGRzLnRvcCAhPT0gdW5kZWZpbmVkICYmIGZpZWxkcy50b3AgPD0gRklFTERfREVGQVVMVFMuYm90dG9tKSB7XG4gICAgICAgICAgICBmaWVsZHMuYm90dG9tID0gZmllbGRzLnRvcCAtIGRlZmF1bHRHcmFwaEhlaWdodDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmllbGRzID0geyAuLi5GSUVMRF9ERUZBVUxUUywgLi4uZmllbGRzIH07XG4gICAgICAgIHRoaXMucG90ZW50aWFsRXJyb3JDYXVzZSA9IHBvdGVudGlhbEVycm9yQ2F1c2U7XG4gICAgICAgIERzbC5hc3NlcnRTYW5pdHkodGhpcy5maWVsZHMpO1xuICAgIH1cblxuICAgIC8qKiBHZXQgYSAoaGV4KSBTSEEtMjU2IGhhc2ggb2YgdGhpcyBvYmplY3QgKi9cbiAgICBwdWJsaWMgYXN5bmMgaGFzaCgpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICBpZiAodGhpcy5faGFzaCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2hhc2g7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkYXRhID0gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKEpTT04uc3RyaW5naWZ5KHRoaXMpKTtcbiAgICAgICAgY29uc3QgYnVmZmVyID0gYXdhaXQgY3J5cHRvLnN1YnRsZS5kaWdlc3QoXCJTSEEtMjU2XCIsIGRhdGEpO1xuICAgICAgICBjb25zdCByYXcgPSBBcnJheS5mcm9tKG5ldyBVaW50OEFycmF5KGJ1ZmZlcikpO1xuICAgICAgICB0aGlzLl9oYXNoID0gcmF3Lm1hcCgoYikgPT4gYi50b1N0cmluZygxNikucGFkU3RhcnQoMiwgXCIwXCIpKS5qb2luKFwiXCIpOyAvLyBjb252ZXJ0IGJpbmFyeSBoYXNoIHRvIGhleFxuICAgICAgICByZXR1cm4gdGhpcy5faGFzaDtcbiAgICB9XG5cbiAgICAvKiogQ2hlY2sgaWYgdGhlIGZpZWxkcyBhcmUgc2FuZSwgdGhyb3dzIGEgYFN5bnRheEVycm9yYCBpZiB0aGV5IGFyZW4ndCAqL1xuICAgIHByaXZhdGUgc3RhdGljIGFzc2VydFNhbml0eShmaWVsZHM6IEZpZWxkcykge1xuICAgICAgICAvLyBFbnN1cmUgYm91bmRhcmllcyBhcmUgY29tcGxldGUgYW5kIGluIG9yZGVyXG4gICAgICAgIGlmIChmaWVsZHMubGVmdCA+PSBmaWVsZHMucmlnaHQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcbiAgICAgICAgICAgICAgICBgUmlnaHQgYm91bmRhcnkgKCR7ZmllbGRzLnJpZ2h0fSkgbXVzdCBiZSBncmVhdGVyIHRoYW4gbGVmdCBib3VuZGFyeSAoJHtmaWVsZHMubGVmdH0pYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmaWVsZHMuYm90dG9tID49IGZpZWxkcy50b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgXG4gICAgICAgICAgICAgICAgVG9wIGJvdW5kYXJ5ICgke2ZpZWxkcy50b3B9KSBtdXN0IGJlIGdyZWF0ZXIgdGhhbiBib3R0b20gYm91bmRhcnkgKCR7ZmllbGRzLmJvdHRvbX0pXG4gICAgICAgICAgICBgKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBBc3NlcnQgaWYgYSBzdHJpbmcgaXMgc2FmZSB0byBpbnRlcnBvbGF0ZSBpbiBhIHN0cmluZyB3cmFwcGVkIGJ5ICdgJyAod2l0aG91dCBhbnkgZXNjYXBpbmcgdnVsbmVyYWJpbGl0aWVzKSxcbiAgICAgKiAgICAgIHRocm93cyBhIGBTeW50YXhFcnJvcmAgaWYgdGhleSBhcmVuJ3QuXG4gICAgICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgYXNzZXJ0U2FmZVRvSW50ZXJwb2xhdGUoc3RyOiBzdHJpbmcsIGN0eD86IHN0cmluZykge1xuICAgICAgICBpZiAoc3RyLmluY2x1ZGVzKFwiYFwiKSkge1xuICAgICAgICAgICAgaWYgKGN0eCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSWxsZWdhbCBjaGFyYWN0ZXIgKFxcYCkgZm91bmQgaW4gJHtjdHggPyBjdHgucmVwbGFjZShcIj9cIiwgc3RyKSA6IFwic3RyaW5nXCJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIHBhcnNlKHNvdXJjZTogc3RyaW5nKTogRHNsIHtcbiAgICAgICAgY29uc3Qgc3BsaXQgPSBzb3VyY2Uuc3BsaXQoXCItLS1cIik7XG5cbiAgICAgICAgbGV0IHBvdGVudGlhbEVycm9yQ2F1c2U6IEhUTUxTcGFuRWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IGVxdWF0aW9uczogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBmaWVsZHM6IFBhcnRpYWw8RmllbGRzPiA9IHt9O1xuICAgICAgICBzd2l0Y2ggKHNwbGl0Lmxlbmd0aCkge1xuICAgICAgICAgICAgY2FzZSAwOiB7XG4gICAgICAgICAgICAgICAgZXF1YXRpb25zID0gW107XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNhc2UgMToge1xuICAgICAgICAgICAgICAgIGVxdWF0aW9ucyA9IHNwbGl0WzBdLnNwbGl0KFwiXFxuXCIpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2FzZSAyOiB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIHR3byBzZWdtZW50cyB0aGVuIHdlIGtub3cgdGhlIGZpcnN0IG9uZSBtdXN0IGNvbnRhaW4gdGhlIHNldHRpbmdzXG4gICAgICAgICAgICAgICAgZmllbGRzID0gc3BsaXRbMF1cbiAgICAgICAgICAgICAgICAgICAgLy8gQWxsb3cgZWl0aGVyIGEgbmV3bGluZSBvciBzZW1pY29sb24gYXMgYSBkZWxpbWl0ZXJcbiAgICAgICAgICAgICAgICAgICAgLnNwbGl0KC9bO1xcbl0rLylcbiAgICAgICAgICAgICAgICAgICAgLm1hcCgoc2V0dGluZykgPT4gc2V0dGluZy50cmltKCkpXG4gICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBhbnkgZW1wdHkgZWxlbWVudHNcbiAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihCb29sZWFuKVxuICAgICAgICAgICAgICAgICAgICAvLyBTcGxpdCBlYWNoIGZpZWxkIG9uIHRoZSBmaXJzdCBlcXVhbHMgc2lnbiB0byBjcmVhdGUgdGhlIGtleT12YWx1ZSBwYWlyXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoKHNldHRpbmcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IFtrZXksIC4uLnZhbHVlXSA9IHNldHRpbmcuc3BsaXQoXCI9XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVHJpbSBlYWNoIGZpZWxkLCB0aGlzIGFsbG93cyB0aGUgdXNlciB0byBwdXQgc3BhY2VzIGFyb3VuZCB0aGUga2V5IG9mIGEgdmFsdWUgaWYgdGhleSB3aXNoXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gW2tleS50cmltKCksIHZhbHVlLmpvaW4oXCI9XCIpLnRyaW0oKV07XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5yZWR1Y2UoKHNldHRpbmdzLCBbaywgdmFsdWVdKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSBrLnRvTG93ZXJDYXNlKCkgYXMga2V5b2YgRmllbGRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGtleSBpbiBGSUVMRF9ERUZBVUxUUykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIGNhbiB1c2UgdGhlIGRlZmF1bHRzIHRvIGRldGVybWluZSB0aGUgdHlwZSBvZiBlYWNoIGZpZWxkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmllbGRWYWx1ZSA9IEZJRUxEX0RFRkFVTFRTW2tleV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmllbGRUeXBlID0gdHlwZW9mIGZpZWxkVmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTYW5pdHkgY2hlY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEc2wuYXNzZXJ0U2FmZVRvSW50ZXJwb2xhdGUodmFsdWUsIGBmaWVsZCAnJHtrZXl9JzogP2ApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQm9vbGVhbiBmaWVsZHMgZGVmYXVsdCB0byBgdHJ1ZWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmllbGRUeXBlICE9PSBcImJvb2xlYW5cIiAmJiAhdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBGaWVsZCAnJHtrZXl9JyBtdXN0IGhhdmUgYSB2YWx1ZWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoZmllbGRUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJudW1iZXJcIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcyA9IHBhcnNlRmxvYXQodmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKE51bWJlci5pc05hTihzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgRmllbGQgJyR7a2V5fScgbXVzdCBoYXZlIGFuIGludGVnZXIgdmFsdWVgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzZXR0aW5nc1trZXldIGFzIG51bWJlcikgPSBzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwiYm9vbGVhblwiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKHNldHRpbmdzW2tleV0gYXMgYm9vbGVhbikgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIVtcInRydWVcIiwgXCJmYWxzZVwiXS5pbmNsdWRlcyh2YWx1ZS50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgRmllbGQgJyR7a2V5fScgcmVxdXJlcyBhIGJvb2xlYW4gdmFsdWUgJ3RydWUnLydmYWxzZScgKG9taXQgYSB2YWx1ZSB0byBkZWZhdWx0IHRvICd0cnVlJylgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKHNldHRpbmdzW2tleV0gYXMgYm9vbGVhbikgPSB2YWx1ZS50b0xvd2VyQ2FzZSgpID09PSBcInRydWVcIiA/IHRydWUgOiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBHb3QgdW5yZWNvZ25pemVkIGZpZWxkIHR5cGUgJHtmaWVsZFR5cGV9IHdpdGggdmFsdWUgJHtmaWVsZFZhbHVlfSwgdGhpcyBpcyBhIGJ1Zy5gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVucmVjb2duaXNlZCBmaWVsZDogJHtrZXl9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZXR0aW5ncztcbiAgICAgICAgICAgICAgICAgICAgfSwge30gYXMgUGFydGlhbDxGaWVsZHM+KTtcblxuICAgICAgICAgICAgICAgIGVxdWF0aW9ucyA9IHNwbGl0WzFdLnNwbGl0KFwiXFxuXCIpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgICAgIGZpZWxkcyA9IHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghZXF1YXRpb25zKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJUb28gbWFueSBzZWdtZW50c1wiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFByb2Nlc3MgZXF1YXRpb25zXG4gICAgICAgIGNvbnN0IHByb2Nlc3NlZCA9IGVxdWF0aW9ucy5tYXAoKGVxKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzZWdtZW50cyA9IGVxLnNwbGl0KFwifFwiKS5tYXAoKHNlZ21lbnQpID0+IHNlZ21lbnQudHJpbSgpKTtcblxuICAgICAgICAgICAgLy8gRmlyc3Qgc2VnbWVudCBpcyBhbHdheXMgdGhlIGVxdWF0aW9uXG4gICAgICAgICAgICBjb25zdCBlcXVhdGlvbjogRXF1YXRpb24gPSB7IGVxdWF0aW9uOiBzZWdtZW50cy5zaGlmdCgpIGFzIHVua25vd24gYXMgc3RyaW5nIH07XG5cbiAgICAgICAgICAgIC8vIFNhbml0eSBjaGVja1xuICAgICAgICAgICAgRHNsLmFzc2VydFNhZmVUb0ludGVycG9sYXRlKGVxdWF0aW9uLmVxdWF0aW9uLCBgZXF1YXRpb246ID9gKTtcblxuICAgICAgICAgICAgLy8gVGhlIHJlc3Qgb2YgdGhlIHNlZ21lbnRzIGNhbiBlaXRoZXIgYmUgdGhlIHJlc3RyaWN0aW9uLCBzdHlsZSwgb3IgY29sb3JcbiAgICAgICAgICAgIC8vICB3aGlsc3Qgd2UgcmVjb21tZW5kIHB1dHRpbmcgdGhlIHJlc3RyaWN0aW9uIGZpcnN0LCB3ZSBhY2NlcHQgdGhlc2UgaW4gYW55IG9yZGVyLlxuICAgICAgICAgICAgZm9yIChjb25zdCBzZWdtZW50IG9mIHNlZ21lbnRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VnbWVudFVwcGVyQ2FzZSA9IHNlZ21lbnQudG9VcHBlckNhc2UoKTtcblxuICAgICAgICAgICAgICAgIC8vIFNhbml0eSBjaGVja1xuICAgICAgICAgICAgICAgIERzbC5hc3NlcnRTYWZlVG9JbnRlcnBvbGF0ZShzZWdtZW50LCBgc2VnbWVudDogP2ApO1xuXG4gICAgICAgICAgICAgICAgLy8gSWYgdGhpcyBpcyBhIHZhbGlkIHN0eWxlIGNvbnN0YW50XG4gICAgICAgICAgICAgICAgaWYgKE9iamVjdC52YWx1ZXMoRXF1YXRpb25TdHlsZSkuaW5jbHVkZXMoc2VnbWVudFVwcGVyQ2FzZSBhcyBFcXVhdGlvblN0eWxlKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVxdWF0aW9uLnN0eWxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcXVhdGlvbi5zdHlsZSA9IHNlZ21lbnRVcHBlckNhc2UgYXMgRXF1YXRpb25TdHlsZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgRHVwbGljYXRlIHN0eWxlIGlkZW50aWZpZXJzIGRldGVjdGVkOiAke2VxdWF0aW9uLnN0eWxlfSwgJHtzZWdtZW50VXBwZXJDYXNlfWBcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBJZiB0aGlzIGlzIGEgdmFsaWQgY29sb3IgY29uc3RhbnQgb3IgaGV4IGNvZGVcbiAgICAgICAgICAgICAgICBlbHNlIGlmIChPYmplY3Qua2V5cyhFcXVhdGlvbkNvbG9yKS5pbmNsdWRlcyhzZWdtZW50VXBwZXJDYXNlKSB8fCBpc0hleENvbG9yKHNlZ21lbnQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXF1YXRpb24uY29sb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0hleENvbG9yKHNlZ21lbnQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXF1YXRpb24uY29sb3IgPSBzZWdtZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcXVhdGlvbi5jb2xvciA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC52YWx1ZXMoRXF1YXRpb25Db2xvcilbT2JqZWN0LmtleXMoRXF1YXRpb25Db2xvcikuaW5kZXhPZihzZWdtZW50VXBwZXJDYXNlKV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYER1cGxpY2F0ZSBjb2xvciBpZGVudGlmaWVycyBkZXRlY3RlZDogJHtlcXVhdGlvbi5jb2xvcn0sICR7c2VnbWVudFVwcGVyQ2FzZX1gXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBhc3N1bWUgaXQgaXMgYSBncmFwaCByZXN0cmljdGlvblxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoKHNlZ21lbnQgYXMgc3RyaW5nKS5pbmNsdWRlcyhcIlxcXFxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSByZXN0cmljdGlvbiBpbmNsdWRlZCBhIGBcXGAgKHRoZSBMYVRlWCBjb250cm9sIGNoYXJhY3RlcikgdGhlbiB0aGUgdXNlciBtYXkgaGF2ZSB0cmllZCB0byB1c2UgdGhlIExhVGVYIHN5bnRheCBpbiB0aGUgZ3JhcGggcmVzdHJpY3Rpb24gKGUuZyBgXFxmcmFjezF9ezJ9YClcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICBEZXNtb3MgZG9lcyBub3QgYWxsb3cgdGhpcyBidXQgcmV0dXJucyBhIGZhaXJseSBhcmNoYWljIGVycm9yIC0gXCJBIHBpZWNld2lzZSBleHByZXNzaW9uIG11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgY29uZGl0aW9uLlwiXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3RlbnRpYWxFcnJvckNhdXNlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJlLmlubmVySFRNTCA9IFwiWW91IG1heSBoYXZlIHRyaWVkIHRvIHVzZSB0aGUgTGFUZVggc3ludGF4IGluIHRoZSBncmFwaCByZXN0cmljdGlvbiAoXCI7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNvZGVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbm5lci5pbm5lclRleHQgPSBzZWdtZW50O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwb3N0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0LmlubmVySFRNTCA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIpLCBwbGVhc2UgdXNlIHNvbWUgc29ydCBvZiBhbiBhbHRlcm5hdGl2ZSAoZS5nIDxjb2RlPlxcXFxmcmFjezF9ezJ9PC9jb2RlPiA9PiA8Y29kZT4xLzI8L2NvZGU+KSBhcyB0aGlzIGlzIG5vdCBzdXBwb3J0ZWQgYnkgRGVzbW9zLlwiO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3RlbnRpYWxFcnJvckNhdXNlLmFwcGVuZENoaWxkKHByZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3RlbnRpYWxFcnJvckNhdXNlLmFwcGVuZENoaWxkKGlubmVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvdGVudGlhbEVycm9yQ2F1c2UuYXBwZW5kQ2hpbGQocG9zdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoIWVxdWF0aW9uLnJlc3RyaWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcXVhdGlvbi5yZXN0cmljdGlvbiA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBEZXNtb3MgYWxsb3dzIG11bHRpcGxlIGdyYXBoIHJlc3RyaWN0aW9ucywgc28gd2UgY2FuIGp1c3QgY29uY2F0ZW5hdGVcbiAgICAgICAgICAgICAgICAgICAgZXF1YXRpb24ucmVzdHJpY3Rpb24gKz0gYHske3NlZ21lbnR9fWA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZXF1YXRpb247XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIExpbWl0IHRoZSBoZWlnaHQgYW5kIHdpZHRoIHRvIHNvbWV0aGluZyByZWFzb25hYmxlXG4gICAgICAgIGlmIChNYXRoLm1heChmaWVsZHMud2lkdGggPz8gMCwgZmllbGRzLmhlaWdodCA/PyAwKSA+IE1BWF9TSVpFKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEdyYXBoIHNpemUgb3V0c2lkZSBvZiBhY2NlcHRlZCBib3VuZHMgKCR7TUFYX1NJWkV9eCR7TUFYX1NJWkV9KWApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBEc2wocHJvY2Vzc2VkLCBmaWVsZHMsIHBvdGVudGlhbEVycm9yQ2F1c2UpO1xuICAgIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiByZW5kZXJFcnJvcihlcnI6IHN0cmluZywgZWw6IEhUTUxFbGVtZW50LCBleHRyYT86IEhUTUxTcGFuRWxlbWVudCkge1xuICAgIGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXG4gICAgY29uc3QgbWVzc2FnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHJvbmdcIik7XG4gICAgbWVzc2FnZS5pbm5lclRleHQgPSBcIkRlc21vcyBHcmFwaCBFcnJvcjogXCI7XG4gICAgd3JhcHBlci5hcHBlbmRDaGlsZChtZXNzYWdlKTtcblxuICAgIGNvbnN0IGN0eCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgIGN0eC5pbm5lclRleHQgPSBlcnI7XG4gICAgd3JhcHBlci5hcHBlbmRDaGlsZChjdHgpO1xuXG4gICAgaWYgKGV4dHJhKSB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2VFeHRyYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHJvbmdcIik7XG4gICAgICAgIG1lc3NhZ2VFeHRyYS5pbm5lckhUTUwgPSBcIjxicj5Ob3RlOiBcIjtcbiAgICAgICAgd3JhcHBlci5hcHBlbmRDaGlsZChtZXNzYWdlRXh0cmEpO1xuICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKGV4dHJhKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGNvbnRhaW5lci5zdHlsZS5wYWRkaW5nID0gXCIyMHB4XCI7XG4gICAgY29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwiI2Y0NDMzNlwiO1xuICAgIGNvbnRhaW5lci5zdHlsZS5jb2xvciA9IFwid2hpdGVcIjtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQod3JhcHBlcik7XG5cbiAgICBlbC5lbXB0eSgpO1xuICAgIGVsLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG59XG4iLCJpbXBvcnQgRGVzbW9zIGZyb20gXCIuL21haW5cIjtcclxuaW1wb3J0IHsgUGx1Z2luU2V0dGluZ1RhYiwgQXBwLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5leHBvcnQgZW51bSBDYWNoZUxvY2F0aW9uIHtcclxuICAgIE1lbW9yeSA9IFwiTWVtb3J5XCIsXHJcbiAgICBGaWxlc3lzdGVtID0gXCJGaWxlc3lzdGVtXCIsXHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU2V0dGluZ3Mge1xyXG4gICAgLyoqIFRoZSBwcm9ncmFtIHZlcnNpb24gdGhlc2Ugc2V0dGluZ3Mgd2VyZSBjcmVhdGVkIGluICovXHJcbiAgICB2ZXJzaW9uOiBzdHJpbmc7XHJcbiAgICAvLyAvKiogVGhlIGRlYm91bmNlIHRpbWVyIChpbiBtcykgKi9cclxuICAgIC8vIGRlYm91bmNlOiBudW1iZXI7XHJcbiAgICBjYWNoZTogQ2FjaGVTZXR0aW5ncztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYWNoZVNldHRpbmdzIHtcclxuICAgIGVuYWJsZWQ6IGJvb2xlYW47XHJcbiAgICBsb2NhdGlvbjogQ2FjaGVMb2NhdGlvbjtcclxuICAgIGRpcmVjdG9yeT86IHN0cmluZztcclxufVxyXG5cclxuY29uc3QgREVGQVVMVF9TRVRUSU5HU19TVEFUSUM6IE9taXQ8U2V0dGluZ3MsIFwidmVyc2lvblwiPiA9IHtcclxuICAgIC8vIGRlYm91bmNlOiA1MDAsXHJcbiAgICBjYWNoZToge1xyXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgbG9jYXRpb246IENhY2hlTG9jYXRpb24uTWVtb3J5LFxyXG4gICAgfSxcclxufTtcclxuXHJcbi8qKiBHZXQgdGhlIGRlZmF1bHQgc2V0dGluZ3MgZm9yIHRoZSBnaXZlbiBwbHVnaW4uIFRoaXMgc2ltcGx5IHVzZXMgYERFRkFVTFRfU0VUVElOR1NfU1RBVElDYCBhbmQgcGF0Y2hlcyB0aGUgdmVyc2lvbiBmcm9tIHRoZSBtYW5pZmVzdC4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIERFRkFVTFRfU0VUVElOR1MocGx1Z2luOiBEZXNtb3MpOiBTZXR0aW5ncyB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHZlcnNpb246IHBsdWdpbi5tYW5pZmVzdC52ZXJzaW9uLFxyXG4gICAgICAgIC4uLkRFRkFVTFRfU0VUVElOR1NfU1RBVElDLFxyXG4gICAgfTtcclxufVxyXG5cclxuLyoqIEF0dGVtcHQgdG8gbWlncmF0ZSB0aGUgZ2l2ZW4gc2V0dGluZ3Mgb2JqZWN0IHRvIHRoZSBjdXJyZW50IHN0cnVjdHVyZSAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbWlncmF0ZVNldHRpbmdzKHBsdWdpbjogRGVzbW9zLCBzZXR0aW5nczogb2JqZWN0KTogU2V0dGluZ3Mge1xyXG4gICAgLy8gdG9kbyAodGhlcmUgaXMgY3VycmVudGx5IG9ubHkgb25lIHZlcnNpb24gb2YgdGhlIHNldHRpbmdzIGludGVyZmFjZSlcclxuICAgIHJldHVybiBzZXR0aW5ncyBhcyBTZXR0aW5ncztcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFNldHRpbmdzVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XHJcbiAgICBwbHVnaW46IERlc21vcztcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBEZXNtb3MpIHtcclxuICAgICAgICBzdXBlcihhcHAsIHBsdWdpbik7XHJcbiAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XHJcbiAgICB9XHJcblxyXG4gICAgZGlzcGxheSgpIHtcclxuICAgICAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG5cclxuICAgICAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG5cclxuICAgICAgICAvLyBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAvLyAgICAgLnNldE5hbWUoXCJEZWJvdW5jZSBUaW1lIChtcylcIilcclxuICAgICAgICAvLyAgICAgLnNldERlc2MoXHJcbiAgICAgICAgLy8gICAgICAgICBcIkhvdyBsb25nIHRvIHdhaXQgYWZ0ZXIgYSBrZXlwcmVzcyB0byByZW5kZXIgdGhlIGdyYXBoIChzZXQgdG8gMCB0byBkaXNhYmxlLCByZXF1aXJlcyByZXN0YXJ0IHRvIHRha2UgZWZmZWN0KVwiXHJcbiAgICAgICAgLy8gICAgIClcclxuICAgICAgICAvLyAgICAgLmFkZFRleHQoKHRleHQpID0+XHJcbiAgICAgICAgLy8gICAgICAgICB0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRlYm91bmNlLnRvU3RyaW5nKCkpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGNvbnN0IHZhbCA9IHBhcnNlSW50KHZhbHVlKTtcclxuICAgICAgICAvLyAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWJvdW5jZSA9XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIE51bWJlci5pc05hTih2YWwpIHx8IHZhbCA8IDAgPyBERUZBVUxUX1NFVFRJTkdTX1NUQVRJQy5kZWJvdW5jZSA6IHZhbDtcclxuICAgICAgICAvLyAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAvLyAgICAgICAgIH0pXHJcbiAgICAgICAgLy8gICAgICk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgICAgICAuc2V0TmFtZShcIkNhY2hlXCIpXHJcbiAgICAgICAgICAgIC5zZXREZXNjKFwiV2hldGhlciB0byBjYWNoZSB0aGUgcmVuZGVyZWQgZ3JhcGhzXCIpXHJcbiAgICAgICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICAgICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5lbmFibGVkKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5lbmFibGVkID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIFJlc2V0IHRoZSBkaXNwbGF5IHNvIHRoZSBuZXcgc3RhdGUgY2FuIHJlbmRlclxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLmNhY2hlLmVuYWJsZWQpIHtcclxuICAgICAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgICAgICAgICAuc2V0TmFtZShcIkNhY2hlIGxvY2F0aW9uXCIpXHJcbiAgICAgICAgICAgICAgICAuc2V0RGVzYyhcIlNldCB0aGUgbG9jYXRpb24gdG8gY2FjaGUgcmVuZGVyZWQgZ3JhcGhzIChub3RlIHRoYXQgbWVtb3J5IGNhY2hpbmcgaXMgbm90IHBlcnNpc3RlbnQpXCIpXHJcbiAgICAgICAgICAgICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxyXG4gICAgICAgICAgICAgICAgICAgIGRyb3Bkb3duXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRPcHRpb24oQ2FjaGVMb2NhdGlvbi5NZW1vcnksIFwiTWVtb3J5XCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRPcHRpb24oQ2FjaGVMb2NhdGlvbi5GaWxlc3lzdGVtLCBcIkZpbGVzeXN0ZW1cIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNhY2hlLmxvY2F0aW9uKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5sb2NhdGlvbiA9IHZhbHVlIGFzIENhY2hlTG9jYXRpb247XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBSZXNldCB0aGUgZGlzcGxheSBzbyB0aGUgbmV3IHN0YXRlIGNhbiByZW5kZXJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5sb2NhdGlvbiA9PT0gQ2FjaGVMb2NhdGlvbi5GaWxlc3lzdGVtKSB7XHJcbiAgICAgICAgICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAgICAgICAgICAgICAuc2V0TmFtZShcIkNhY2hlIERpcmVjdG9yeVwiKVxyXG4gICAgICAgICAgICAgICAgICAgIC5zZXREZXNjKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBgVGhlIGRpcmVjdG9yeSB0byBzYXZlIGNhY2hlZCBncmFwaHMgaW4sIHJlbGF0aXZlIHRvIHRoZSB2YXVsdCByb290ICh0ZWNobmljYWwgbm90ZTogdGhlIGdyYXBocyB3aWxsIGJlIHNhdmVkIGFzIFxcYGRlc21vcy1ncmFwaC08aGFzaD4ucG5nXFxgIHdoZXJlIHRoZSBuYW1lIGlzIGEgU0hBLTI1NiBoYXNoIG9mIHRoZSBncmFwaCBzb3VyY2UpLiBBbHNvIG5vdGUgdGhhdCBhIGxvdCBvZiBqdW5rIHdpbGwgYmUgc2F2ZWQgdG8gdGhpcyBmb2xkZXIsIHlvdSBoYXZlIGJlZW4gd2FybmVkLmBcclxuICAgICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICAgICAgLmFkZFRleHQoKHRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5kaXJlY3RvcnkgPz8gXCJcIikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5kaXJlY3RvcnkgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgRGVzbW9zIGZyb20gXCIuL21haW5cIjtcclxuaW1wb3J0IHsgcmVuZGVyRXJyb3IgfSBmcm9tIFwiLi9lcnJvclwiO1xyXG5pbXBvcnQgeyBDYWNoZUxvY2F0aW9uIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcclxuaW1wb3J0IHsgRHNsLCBFcXVhdGlvblN0eWxlIH0gZnJvbSBcIi4vZHNsXCI7XHJcbmltcG9ydCB7IG5vcm1hbGl6ZVBhdGgsIE5vdGljZSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuaW50ZXJmYWNlIFJlbmRlckRhdGEge1xyXG4gICAgYXJnczogRHNsO1xyXG4gICAgZWw6IEhUTUxFbGVtZW50O1xyXG4gICAgY2FjaGVGaWxlPzogc3RyaW5nO1xyXG4gICAgcmVzb2x2ZTogKCkgPT4gdm9pZDtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFJlbmRlcmVyIHtcclxuICAgIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBEZXNtb3M7XHJcbiAgICAvKiogVGhlIHNldCBvZiBncmFwaHMgd2UgYXJlIGN1cnJlbnRseSByZW5kZXJpbmcsIG1hcHBlZCBieSB0aGVpciBoYXNoICovXHJcbiAgICBwcml2YXRlIHJlbmRlcmluZzogTWFwPHN0cmluZywgUmVuZGVyRGF0YT4gPSBuZXcgTWFwKCk7XHJcbiAgICBwcml2YXRlIGFjdGl2ZTogYm9vbGVhbjtcclxuXHJcbiAgICBwdWJsaWMgY29uc3RydWN0b3IocGx1Z2luOiBEZXNtb3MpIHtcclxuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgICAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBhY3RpdmF0ZSgpIHtcclxuICAgICAgICBpZiAoIXRoaXMuYWN0aXZlKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCB0aGlzLmhhbmRsZXIuYmluZCh0aGlzKSk7XHJcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGRlYWN0aXZhdGUoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCB0aGlzLmhhbmRsZXIuYmluZCh0aGlzKSk7XHJcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBhc3luYyByZW5kZXIoYXJnczogRHNsLCBlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBjb25zdCBwbHVnaW4gPSB0aGlzLnBsdWdpbjtcclxuICAgICAgICBjb25zdCBzZXR0aW5ncyA9IHBsdWdpbi5zZXR0aW5ncztcclxuXHJcbiAgICAgICAgY29uc3QgeyBmaWVsZHMsIGVxdWF0aW9ucyB9ID0gYXJncztcclxuICAgICAgICBjb25zdCBoYXNoID0gYXdhaXQgYXJncy5oYXNoKCk7XHJcblxyXG4gICAgICAgIGxldCBjYWNoZUZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgLy8gSWYgdGhpcyBncmFwaCBpcyBpbiB0aGUgY2FjaGUgdGhlbiBmZXRjaCBpdFxyXG4gICAgICAgIGlmIChzZXR0aW5ncy5jYWNoZS5lbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmIChzZXR0aW5ncy5jYWNoZS5sb2NhdGlvbiA9PT0gQ2FjaGVMb2NhdGlvbi5NZW1vcnkgJiYgaGFzaCBpbiBwbHVnaW4uZ3JhcGhDYWNoZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHBsdWdpbi5ncmFwaENhY2hlW2hhc2hdO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImltZ1wiKTtcclxuICAgICAgICAgICAgICAgIGltZy5zcmMgPSBkYXRhO1xyXG4gICAgICAgICAgICAgICAgZWwuYXBwZW5kQ2hpbGQoaW1nKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChzZXR0aW5ncy5jYWNoZS5sb2NhdGlvbiA9PT0gQ2FjaGVMb2NhdGlvbi5GaWxlc3lzdGVtICYmIHNldHRpbmdzLmNhY2hlLmRpcmVjdG9yeSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgYWRhcHRlciA9IHBsdWdpbi5hcHAudmF1bHQuYWRhcHRlcjtcclxuXHJcbiAgICAgICAgICAgICAgICBjYWNoZUZpbGUgPSBub3JtYWxpemVQYXRoKGAke3NldHRpbmdzLmNhY2hlLmRpcmVjdG9yeX0vZGVzbW9zLWdyYXBoLSR7aGFzaH0ucG5nYCk7XHJcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGlzIGdyYXBoIGlzIGluIHRoZSBjYWNoZVxyXG4gICAgICAgICAgICAgICAgaWYgKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKGNhY2hlRmlsZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW1nXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGltZy5zcmMgPSBhZGFwdGVyLmdldFJlc291cmNlUGF0aChjYWNoZUZpbGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGVsLmFwcGVuZENoaWxkKGltZyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBleHByZXNzaW9ucyA9IGVxdWF0aW9ucy5tYXAoXHJcbiAgICAgICAgICAgIChlcXVhdGlvbikgPT5cclxuICAgICAgICAgICAgICAgIGBjYWxjdWxhdG9yLnNldEV4cHJlc3Npb24oe1xyXG4gICAgICAgICAgICAgICAgICAgIGxhdGV4OiBcXGAke2VxdWF0aW9uLmVxdWF0aW9uLnJlcGxhY2UoXCJcXFxcXCIsIFwiXFxcXFxcXFxcIil9JHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBpbnRlcnBvbGF0aW9uIGlzIHNhZmUgYXMgd2UgZW5zdXJlZCB0aGUgc3RyaW5nIGRpZCBub3QgY29udGFpbiBhbnkgcXVvdGVzIGluIHRoZSBwYXJzZXJcclxuICAgICAgICAgICAgICAgICAgICAoZXF1YXRpb24ucmVzdHJpY3Rpb24gPz8gXCJcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2VBbGwoXCJ7XCIsIFwiXFxcXFxcXFx7XCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlQWxsKFwifVwiLCBcIlxcXFxcXFxcfVwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZUFsbChcIjw9XCIsIFwiXFxcXFxcXFxsZXEgXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlQWxsKFwiPj1cIiwgXCJcXFxcXFxcXGdlcSBcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2VBbGwoXCI8XCIsIFwiXFxcXFxcXFxsZSBcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2VBbGwoXCI+XCIsIFwiXFxcXFxcXFxnZSBcIilcclxuICAgICAgICAgICAgICAgIH1cXGAsXHJcblxyXG4gICAgICAgICAgICAgICAgICAgICR7KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVxdWF0aW9uLnN0eWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW0VxdWF0aW9uU3R5bGUuU29saWQsIEVxdWF0aW9uU3R5bGUuRGFzaGVkLCBFcXVhdGlvblN0eWxlLkRvdHRlZF0uY29udGFpbnMoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVxdWF0aW9uLnN0eWxlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGBsaW5lU3R5bGU6IERlc21vcy5TdHlsZXMuJHtlcXVhdGlvbi5zdHlsZX0sYDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW0VxdWF0aW9uU3R5bGUuUG9pbnQsIEVxdWF0aW9uU3R5bGUuT3BlbiwgRXF1YXRpb25TdHlsZS5Dcm9zc10uY29udGFpbnMoZXF1YXRpb24uc3R5bGUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYHBvaW50U3R5bGU6IERlc21vcy5TdHlsZXMuJHtlcXVhdGlvbi5zdHlsZX0sYDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgfSkoKX1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgJHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXF1YXRpb24uY29sb3JcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gYGNvbG9yOiBcXGAke2VxdWF0aW9uLmNvbG9yfVxcYCxgIC8vIGludGVycG9sYXRpb24gaXMgc2FmZSBhcyB3ZSBlbnN1cmVkIHRoZSBzdHJpbmcgd2FzIGFscGhhbnVtZXJpYyBpbiB0aGUgcGFyc2VyXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IFwiXCJcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtgXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgLy8gQmVjYXVzZSBvZiB0aGUgZWxlY3Ryb24gc2FuZGJveGluZyB3ZSBoYXZlIHRvIGRvIHRoaXMgaW5zaWRlIGFuIGlmcmFtZSAoYW5kIHJlZ2FyZGxlc3MgdGhpcyBpcyBzYWZlciksXHJcbiAgICAgICAgLy8gICBvdGhlcndpc2Ugd2UgY2FuJ3QgaW5jbHVkZSB0aGUgZGVzbW9zIEFQSSAoYWx0aG91Z2ggaXQgd291bGQgYmUgbmljZSBpZiB0aGV5IGhhZCBhIFJFU1QgQVBJIG9mIHNvbWUgc29ydClcclxuICAgICAgICAvLyBJbnRlcmVzdGluZ2x5IGVub3VnaCwgdGhpcyBzY3JpcHQgZnVuY3Rpb25zIHBlcmZlY3RseSBmaW5lIGZ1bGx5IG9mZmxpbmUgLSBzbyB3ZSBjb3VsZCBpbmNsdWRlIGEgdmVuZG9yZWQgY29weSBpZiBuZWVkIGJlXHJcbiAgICAgICAgLy8gICAodGhlIHNjcmlwdCBnZXRzIGNhY2hlZCBieSBlbGVjdHJvbiB0aGUgZmlyc3QgdGltZSBpdCdzIHVzZWQgc28gdGhpcyBpc24ndCBhIHBhcnRpY3VsYXJseSBoaWdoIHByaW9yaXR5KVxyXG4gICAgICAgIGNvbnN0IGh0bWxIZWFkID0gYDxzY3JpcHQgc3JjPVwiaHR0cHM6Ly93d3cuZGVzbW9zLmNvbS9hcGkvdjEuNi9jYWxjdWxhdG9yLmpzP2FwaUtleT1kY2IzMTcwOWI0NTJiMWNmOWRjMjY5NzJhZGQwZmRhNlwiPjwvc2NyaXB0PmA7XHJcbiAgICAgICAgY29uc3QgaHRtbEJvZHkgPSBgXHJcbiAgICAgICAgICAgIDxkaXYgaWQ9XCJjYWxjdWxhdG9yLSR7aGFzaH1cIiBzdHlsZT1cIndpZHRoOiAke2ZpZWxkcy53aWR0aH1weDsgaGVpZ2h0OiAke2ZpZWxkcy5oZWlnaHR9cHg7XCI+PC9kaXY+XHJcbiAgICAgICAgICAgIDxzY3JpcHQ+XHJcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIHNldHRpbmdzTWVudTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbnM6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGxvY2tWaWV3UG9ydDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICB6b29tQnV0dG9uczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgdHJhY2U6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIHNob3dHcmlkOiAke2ZpZWxkcy5ncmlkfSxcclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgY2FsY3VsYXRvciA9IERlc21vcy5HcmFwaGluZ0NhbGN1bGF0b3IoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjYWxjdWxhdG9yLSR7aGFzaH1cIiksIG9wdGlvbnMpO1xyXG4gICAgICAgICAgICAgICAgY2FsY3VsYXRvci5zZXRNYXRoQm91bmRzKHtcclxuICAgICAgICAgICAgICAgICAgICBsZWZ0OiAke2ZpZWxkcy5sZWZ0fSxcclxuICAgICAgICAgICAgICAgICAgICByaWdodDogJHtmaWVsZHMucmlnaHR9LFxyXG4gICAgICAgICAgICAgICAgICAgIHRvcDogJHtmaWVsZHMudG9wfSxcclxuICAgICAgICAgICAgICAgICAgICBib3R0b206ICR7ZmllbGRzLmJvdHRvbX0sXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAke2V4cHJlc3Npb25zLmpvaW4oXCJcIil9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gRGVzbW9zIHJldHVybnMgYW4gZXJyb3IgaWYgd2UgdHJ5IHRvIG9ic2VydmUgdGhlIGV4cHJlc3Npb25zIHdpdGhvdXQgYW55IGRlZmluZWRcclxuICAgICAgICAgICAgICAgIGlmICgke2V4cHJlc3Npb25zLmxlbmd0aCA+IDB9KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsY3VsYXRvci5vYnNlcnZlKFwiZXhwcmVzc2lvbkFuYWx5c2lzXCIsICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBpZCBpbiBjYWxjdWxhdG9yLmV4cHJlc3Npb25BbmFseXNpcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYW5hbHlzaXMgPSBjYWxjdWxhdG9yLmV4cHJlc3Npb25BbmFseXNpc1tpZF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYW5hbHlzaXMuaXNFcnJvcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudC5wb3N0TWVzc2FnZSh7IHQ6IFwiZGVzbW9zLWdyYXBoXCIsIGQ6IFwiZXJyb3JcIiwgbzogXCIke1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3JpZ2luXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVwiLCBkYXRhOiBhbmFseXNpcy5lcnJvck1lc3NhZ2UsIGhhc2g6IFwiJHtoYXNofVwiIH0sIFwiJHt3aW5kb3cub3JpZ2lufVwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNhbGN1bGF0b3IuYXN5bmNTY3JlZW5zaG90KHsgc2hvd0xhYmVsczogdHJ1ZSwgZm9ybWF0OiBcInBuZ1wiIH0sIChkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5pbm5lckhUTUwgPSBcIlwiO1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudC5wb3N0TWVzc2FnZSh7IHQ6IFwiZGVzbW9zLWdyYXBoXCIsIGQ6IFwicmVuZGVyXCIsIG86IFwiJHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9yaWdpblxyXG4gICAgICAgICAgICAgICAgICAgIH1cIiwgZGF0YSwgaGFzaDogXCIke2hhc2h9XCIgfSwgXCIke3dpbmRvdy5vcmlnaW59XCIpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIDwvc2NyaXB0PlxyXG4gICAgICAgIGA7XHJcbiAgICAgICAgY29uc3QgaHRtbFNyYyA9IGA8aHRtbD48aGVhZD4ke2h0bWxIZWFkfTwvaGVhZD48Ym9keT4ke2h0bWxCb2R5fTwvYm9keT5gO1xyXG5cclxuICAgICAgICBjb25zdCBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaWZyYW1lXCIpO1xyXG4gICAgICAgIGlmcmFtZS5zYW5kYm94LmFkZChcImFsbG93LXNjcmlwdHNcIik7IC8vIGVuYWJsZSBzYW5kYm94IG1vZGUgLSB0aGlzIHByZXZlbnRzIGFueSB4c3MgZXhwbG9pdHMgZnJvbSBhbiB1bnRydXN0ZWQgc291cmNlIGluIHRoZSBmcmFtZSAoYW5kIHByZXZlbnRzIGl0IGZyb20gYWNjZXNzaW5nIHRoZSBwYXJlbnQpXHJcbiAgICAgICAgaWZyYW1lLndpZHRoID0gZmllbGRzLndpZHRoLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgaWZyYW1lLmhlaWdodCA9IGZpZWxkcy5oZWlnaHQudG9TdHJpbmcoKTtcclxuICAgICAgICBpZnJhbWUuc3R5bGUuYm9yZGVyID0gXCJub25lXCI7XHJcbiAgICAgICAgaWZyYW1lLnNjcm9sbGluZyA9IFwibm9cIjsgLy8gZml4bWUgdXNlIGEgbm9uLWRlcHJlY2lhdGVkIGZ1bmN0aW9uXHJcbiAgICAgICAgaWZyYW1lLnNyY2RvYyA9IGh0bWxTcmM7XHJcbiAgICAgICAgLy8gaWZyYW1lLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjsgLy8gZml4bWUgaGlkaW5nIHRoZSBpZnJhbWUgYnJlYWtzIHRoZSBwb3NpdGlvbmluZ1xyXG5cclxuICAgICAgICBlbC5hcHBlbmRDaGlsZChpZnJhbWUpO1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHRoaXMucmVuZGVyaW5nLnNldChoYXNoLCB7IGFyZ3MsIGVsLCByZXNvbHZlLCBjYWNoZUZpbGUgfSkpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlcihcclxuICAgICAgICBtZXNzYWdlOiBNZXNzYWdlRXZlbnQ8eyB0OiBzdHJpbmc7IGQ6IHN0cmluZzsgbzogc3RyaW5nOyBkYXRhOiBzdHJpbmc7IGhhc2g6IHN0cmluZyB9PlxyXG4gICAgKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgaWYgKG1lc3NhZ2UuZGF0YS5vID09PSB3aW5kb3cub3JpZ2luICYmIG1lc3NhZ2UuZGF0YS50ID09PSBcImRlc21vcy1ncmFwaFwiKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5yZW5kZXJpbmcuZ2V0KG1lc3NhZ2UuZGF0YS5oYXNoKTtcclxuICAgICAgICAgICAgaWYgKHN0YXRlKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB7IGFyZ3MsIGVsLCByZXNvbHZlLCBjYWNoZUZpbGUgfSA9IHN0YXRlO1xyXG5cclxuICAgICAgICAgICAgICAgIGVsLmVtcHR5KCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKG1lc3NhZ2UuZGF0YS5kID09PSBcImVycm9yXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZW5kZXJFcnJvcihtZXNzYWdlLmRhdGEuZGF0YSwgZWwsIGFyZ3MucG90ZW50aWFsRXJyb3JDYXVzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpOyAvLyBsZXQgY2FsbGVyIGtub3cgd2UgYXJlIGRvbmUgcmVuZGVyaW5nXHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1lc3NhZ2UuZGF0YS5kID09PSBcInJlbmRlclwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBkYXRhIH0gPSBtZXNzYWdlLmRhdGE7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbWdcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgaW1nLnNyYyA9IGRhdGE7XHJcbiAgICAgICAgICAgICAgICAgICAgZWwuYXBwZW5kQ2hpbGQoaW1nKTtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7IC8vIGxldCBjYWxsZXIga25vdyB3ZSBhcmUgZG9uZSByZW5kZXJpbmdcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGx1Z2luID0gdGhpcy5wbHVnaW47XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3MgPSBwbHVnaW4uc2V0dGluZ3M7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzaCA9IGF3YWl0IGFyZ3MuaGFzaCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzZXR0aW5ncy5jYWNoZS5lbmFibGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXR0aW5ncy5jYWNoZS5sb2NhdGlvbiA9PT0gQ2FjaGVMb2NhdGlvbi5NZW1vcnkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBsdWdpbi5ncmFwaENhY2hlW2hhc2hdID0gZGF0YTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzZXR0aW5ncy5jYWNoZS5sb2NhdGlvbiA9PT0gQ2FjaGVMb2NhdGlvbi5GaWxlc3lzdGVtKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhZGFwdGVyID0gcGx1Z2luLmFwcC52YXVsdC5hZGFwdGVyO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYWNoZUZpbGUgJiYgc2V0dGluZ3MuY2FjaGUuZGlyZWN0b3J5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKHNldHRpbmdzLmNhY2hlLmRpcmVjdG9yeSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gQnVmZmVyLmZyb20oZGF0YS5yZXBsYWNlKC9eZGF0YTppbWFnZVxcL3BuZztiYXNlNjQsLywgXCJcIiksIFwiYmFzZTY0XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBhZGFwdGVyLndyaXRlQmluYXJ5KGNhY2hlRmlsZSwgYnVmZmVyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW51c2VkLWV4cHJlc3Npb25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBkZXNtb3MtZ3JhcGg6IHRhcmdldCBjYWNoZSBkaXJlY3RvcnkgJyR7c2V0dGluZ3MuY2FjaGUuZGlyZWN0b3J5fScgZG9lcyBub3QgZXhpc3QsIHNraXBwaW5nIGNhY2hlYCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEwMDAwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW51c2VkLWV4cHJlc3Npb25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgZGVzbW9zLWdyYXBoOiBmaWxlc3lzdGVtIGNhY2hpbmcgZW5hYmxlZCBidXQgbm8gY2FjaGUgZGlyZWN0b3J5IHNldCwgc2tpcHBpbmcgY2FjaGVgLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxMDAwMFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJpbmcuZGVsZXRlKG1lc3NhZ2UuZGF0YS5oYXNoKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIGRvIG5vdGhpbmcgaWYgZ3JhcGggaXMgbm90IGluIHJlbmRlciBsaXN0ICh0aGlzIHNob3VsZCBub3QgaGFwcGVuKVxyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxyXG4gICAgICAgICAgICAgICAgICAgIGBHb3QgZ3JhcGggbm90IGluIHJlbmRlciBsaXN0LCB0aGlzIGlzIHByb2JhYmx5IGEgYnVnIC0gJHtKU09OLnN0cmluZ2lmeSh0aGlzLnJlbmRlcmluZyl9YFxyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgeyBEc2wgfSBmcm9tIFwiLi9kc2xcIjtcclxuaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB7IFJlbmRlcmVyIH0gZnJvbSBcIi4vcmVuZGVyZXJcIjtcclxuaW1wb3J0IHsgcmVuZGVyRXJyb3IgfSBmcm9tIFwiLi9lcnJvclwiO1xyXG5pbXBvcnQgeyBERUZBVUxUX1NFVFRJTkdTLCBtaWdyYXRlU2V0dGluZ3MsIFNldHRpbmdzLCBTZXR0aW5nc1RhYiB9IGZyb20gXCIuL3NldHRpbmdzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEZXNtb3MgZXh0ZW5kcyBQbHVnaW4ge1xyXG4gICAgLy8gV2UgbG9hZCB0aGUgc2V0dGluZ3MgYmVmb3JlIGFjY2Vzc2luZyB0aGVtLCBzbyB3ZSBjYW4gZW5zdXJlIHRoaXMgb2JqZWN0IGFsd2F5cyBleGlzdHNcclxuICAgIHNldHRpbmdzITogU2V0dGluZ3M7XHJcblxyXG4gICAgLy8gV2UgY3JlYXRlIHRoZSByZW5kZXJlciBiZWZvcmUgcmVnaXN0ZXJpbmcgdGhlIGNvZGVibG9jaywgc28gd2UgY2FuIGVuc3VyZSB0aGlzIG9iamVjdCBhbHdheXMgZXhpc3RzXHJcbiAgICByZW5kZXJlciE6IFJlbmRlcmVyO1xyXG5cclxuICAgIC8qKiBIZWxwZXIgZm9yIGluLW1lbW9yeSBncmFwaCBjYWNoaW5nICovXHJcbiAgICBncmFwaENhY2hlOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XHJcblxyXG4gICAgYXN5bmMgb25sb2FkKCkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XHJcbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IG5ldyBSZW5kZXJlcih0aGlzKTtcclxuICAgICAgICB0aGlzLnJlbmRlcmVyLmFjdGl2YXRlKCk7XHJcblxyXG4gICAgICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgU2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcbiAgICAgICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKFwiZGVzbW9zLWdyYXBoXCIsIGFzeW5jIChzb3VyY2UsIGVsKSA9PiB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBhcmdzID0gRHNsLnBhcnNlKHNvdXJjZSk7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnJlbmRlcmVyLnJlbmRlcihhcmdzLCBlbCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVuZGVyRXJyb3IoZXJyLm1lc3NhZ2UsIGVsKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGVyciA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlbmRlckVycm9yKGVyciwgZWwpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZW5kZXJFcnJvcihcIlVuZXhwZWN0ZWQgZXJyb3IgLSBzZWUgY29uc29sZSBmb3IgZGVidWcgbG9nXCIsIGVsKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyB1bmxvYWQoKSB7XHJcbiAgICAgICAgdGhpcy5yZW5kZXJlci5kZWFjdGl2YXRlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xyXG4gICAgICAgIGxldCBzZXR0aW5ncyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKTtcclxuXHJcbiAgICAgICAgaWYgKCFzZXR0aW5ncykge1xyXG4gICAgICAgICAgICBzZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1ModGhpcyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoc2V0dGluZ3MudmVyc2lvbiAhPT0gdGhpcy5tYW5pZmVzdC52ZXJzaW9uKSB7XHJcbiAgICAgICAgICAgIHNldHRpbmdzID0gbWlncmF0ZVNldHRpbmdzKHRoaXMsIHNldHRpbmdzKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuICAgIH1cclxufVxyXG4iXSwibmFtZXMiOlsiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJub3JtYWxpemVQYXRoIiwiTm90aWNlIiwiUGx1Z2luIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXVEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFL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
