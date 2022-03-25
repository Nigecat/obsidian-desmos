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
/// The time to wait (in ms) before triggering an update
const UPDATE_TIMEOUT = 250;
const FIELD_DEFAULTS = {
    lock: false,
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
    constructor(plugin, ctx, target, equations, fields, potentialErrorCause) {
        this.plugin = plugin;
        this.ctx = ctx;
        this.target = target;
        this.equations = equations;
        this.fields = Object.assign(Object.assign({}, FIELD_DEFAULTS), fields);
        this.potentialErrorCause = potentialErrorCause;
        this.update = obsidian.debounce(this._update.bind(this), UPDATE_TIMEOUT, true);
        Dsl.assert_sanity(this.fields);
    }
    /** Get a (hex) SHA-256 hash of the fields and equations of this object */
    hash() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._hash) {
                return this._hash;
            }
            const data = new TextEncoder().encode(JSON.stringify({ fields: this.fields, equations: this.equations }));
            const buffer = yield crypto.subtle.digest("SHA-256", data);
            const raw = Array.from(new Uint8Array(buffer));
            this._hash = raw.map((b) => b.toString(16).padStart(2, "0")).join(""); // convert binary hash to hex
            return this._hash;
        });
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
    /** Ensure a string does not contain any of the banned characters (this is mostly a sanity check to prevent vulnerabilities in later interpolation) */
    static assert_notbanned(value, ctx) {
        const bannedChars = ['"', "'", "`"];
        for (const c of bannedChars) {
            if (value.includes(c)) {
                throw new SyntaxError(`Unexpected character ${c} in ${ctx}`);
            }
        }
    }
    _update(fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.ctx.sourcePath;
            const location = this.ctx.getSectionInfo(this.target);
            if (file && location) {
                this.fields = Object.assign(Object.assign({}, this.fields), fields);
                const path = obsidian.normalizePath(file);
                const contents = yield this.plugin.app.vault.adapter.read(path);
                const start = contents.indexOf(location.text);
                const end = start + location.text.length;
                console.log(location.text);
                contents.slice(start, end);
                console.log(`${start}..${end}`);
                console.log(contents.slice(start, end));
                // todo
                // console.log(this.fields, file, location);
            }
            else {
                console.error("unable to find source of live graph");
            }
        });
    }
    static parse(plugin, ctx, target, source) {
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
                    return [key, value.join("=")];
                })
                    .reduce((settings, [k, value]) => {
                    const key = k.toLowerCase();
                    if (FIELD_DEFAULTS.hasOwnProperty(key)) {
                        // We can use the defaults to determine the type of each field
                        const fieldValue = FIELD_DEFAULTS[key];
                        const fieldType = typeof fieldValue;
                        if (fieldType !== "boolean" && !value) {
                            throw new SyntaxError(`Field '${key}' must have a value`);
                        }
                        switch (fieldType) {
                            case "number": {
                                const s = parseFloat(value);
                                if (Number.isNaN(s)) {
                                    throw new SyntaxError(`Field '${key}' must have an integer (or float) value`);
                                }
                                settings[key] = s;
                                break;
                            }
                            case "boolean": {
                                if (value) {
                                    throw new SyntaxError(`Unexpected value '${value}' for boolean key '${key}'`);
                                }
                                settings[key] = true;
                                break;
                            }
                            default: {
                                throw new SyntaxError(`Got unrecognized field type ${fieldType} with value ${fieldValue}, this is a bug.`);
                            }
                            // case "string": {
                            //     this.assert_notbanned(value, `field value for key: '${key}'`);
                            //     (settings as any)[key] = value;
                            //     break;
                            // }
                            // case "object": {
                            //     const val = JSON.parse(value);
                            //     if (
                            //         val.constructor === fieldValue.constructor
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
        return new Dsl(plugin, ctx, target, processed, fields, potentialErrorCause);
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
    live: false,
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
            .setName("Live")
            .setDesc("Whether live mode is enabled, this will allow you to directly interact with the rendered graph to modify the positioning and scale")
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.live).onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.live = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName("Cache")
            .setDesc("Whether to cache the rendered graphs (note that if live mode is enabled caching will only run on graphs marked with `lock`)")
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
    render(live, args, el) {
        return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
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
                    resolve();
                    return;
                }
                else if (!live && settings.cache.location === CacheLocation.Filesystem && settings.cache.directory) {
                    const adapter = plugin.app.vault.adapter;
                    cacheFile = obsidian.normalizePath(`${settings.cache.directory}/desmos-graph-${hash}.png`);
                    // If this graph is in the cache
                    if (yield adapter.exists(cacheFile)) {
                        const img = document.createElement("img");
                        img.src = adapter.getResourcePath(cacheFile);
                        el.appendChild(img);
                        resolve();
                        return;
                    }
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
                            parent.postMessage({ t: "desmos-graph", d: "error", o: "${window.origin}", data: analysis.errorMessage, hash: "${hash}" }, "${window.origin}");
                        }
                    }
                });

                if (${live}) {
                    calculator.observe("graphpaperBounds", () => {
                        const bounds = calculator.graphpaperBounds.mathCoordinates;
                        const update = {
                            left: bounds.left,
                            right: bounds.right,
                            bottom: bounds.bottom,
                            top: bounds.top,
                        };

                        parent.postMessage({ t: "desmos-graph", d: "update", o: "${window.origin}", data: JSON.stringify(update), hash: "${hash}" }, "${window.origin}");
                    });
                } else {
                    calculator.asyncScreenshot({ showLabels: true, format: "png" }, (data) => {
                        document.body.innerHTML = "";
                        parent.postMessage({ t: "desmos-graph", d: "render", o: "${window.origin}", data, hash: "${hash}" }, "${window.origin}");
                    });
                }
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
            this.rendering.set(hash, { args, el, live, resolve, cacheFile });
        }));
    }
    handler(message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (message.data.o === window.origin && message.data.t === "desmos-graph") {
                const state = this.rendering.get(message.data.hash);
                if (state) {
                    const { args, el, resolve, cacheFile } = state;
                    if (message.data.d !== "update") {
                        el.empty();
                    }
                    if (message.data.d === "error") {
                        renderError(message.data.data, el, args.potentialErrorCause);
                        resolve();
                    }
                    else if (message.data.d === "update") {
                        const data = JSON.parse(message.data.data);
                        args.update(data);
                        return;
                        // resolve();
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
                            else if (!state.live && settings.cache.location === CacheLocation.Filesystem) {
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
                    console.warn(`Got graph not in render list, this is probably a bug - ${this.rendering}`);
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
            this.registerMarkdownCodeBlockProcessor("desmos-graph", (source, el, ctx) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const args = Dsl.parse(this, ctx, el, source);
                    const live = args.fields.lock ? false : this.settings.live;
                    yield this.renderer.render(live, args, el);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9kc2wudHMiLCJzcmMvZXJyb3IudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6bnVsbCwibmFtZXMiOlsiZGVib3VuY2UiLCJub3JtYWxpemVQYXRoIiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJOb3RpY2UiLCJQbHVnaW4iXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBdURBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ2hILElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQy9ELFFBQVEsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNuRyxRQUFRLFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFD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
