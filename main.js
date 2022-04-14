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

/** Calculate a unique SHA-256 hash for the given object */
function calculateHash(val) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = new TextEncoder().encode(JSON.stringify(val));
        const buffer = yield crypto.subtle.digest("SHA-256", data);
        const raw = Array.from(new Uint8Array(buffer));
        // Convery binary hash to hex
        const hash = raw.map((b) => b.toString(16).padStart(2, "0")).join("");
        return hash;
    });
}
/** Unsafe cast method.
 *  Will transform the given type `F` into `T`,
 *      use only when you know this will be valid. */
function ucast(o) {
    return o;
}

var DegreeMode;
(function (DegreeMode) {
    DegreeMode["Radians"] = "RADIANS";
    DegreeMode["Degrees"] = "DEGREES";
})(DegreeMode || (DegreeMode = {}));
var LineStyle;
(function (LineStyle) {
    LineStyle["Solid"] = "SOLID";
    LineStyle["Dashed"] = "DASHED";
    LineStyle["Dotted"] = "DOTTED";
})(LineStyle || (LineStyle = {}));
var PointStyle;
(function (PointStyle) {
    PointStyle["Point"] = "POINT";
    PointStyle["Open"] = "OPEN";
    PointStyle["Cross"] = "CROSS";
})(PointStyle || (PointStyle = {}));
var ColorConstant;
(function (ColorConstant) {
    ColorConstant["Red"] = "#ff0000";
    ColorConstant["Green"] = "#00ff00";
    ColorConstant["Blue"] = "#0000ff";
    ColorConstant["Yellow"] = "#ffff00";
    ColorConstant["Magenta"] = "#ff00ff";
    ColorConstant["Cyan"] = "#00ffff";
    ColorConstant["Purple"] = "#6042a6";
    ColorConstant["Orange"] = "#ffa500";
    ColorConstant["Black"] = "#000000";
    ColorConstant["White"] = "#ffffff";
})(ColorConstant || (ColorConstant = {}));

/** The maximum dimensions of a graph */
const MAX_SIZE = 99999;
const DEFAULT_GRAPH_SETTINGS = {
    width: 600,
    height: 400,
    left: -10,
    right: 10,
    bottom: -7,
    top: 7,
    grid: true,
    degreeMode: DegreeMode.Radians,
};
const DEFAULT_GRAPH_WIDTH = Math.abs(DEFAULT_GRAPH_SETTINGS.left) + Math.abs(DEFAULT_GRAPH_SETTINGS.right);
const DEFAULT_GRAPH_HEIGHT = Math.abs(DEFAULT_GRAPH_SETTINGS.bottom) + Math.abs(DEFAULT_GRAPH_SETTINGS.top);
function parseStringToEnum(obj, key) {
    const objKey = Object.keys(obj).find((k) => k.toUpperCase() === key.toUpperCase());
    return objKey ? obj[objKey] : null;
}
function parseColor(value) {
    // If the value is a valid hex colour
    if (value.startsWith("#")) {
        // Ensure the rest of the value is a valid alphanumeric string
        if (/^[0-9a-zA-Z]+$/.test(value.slice(1))) {
            return value;
        }
    }
    // If the value is a valid colour constant
    return parseStringToEnum(ColorConstant, value);
}
class Graph {
    constructor(equations, settings, potentialErrorHint) {
        this.equations = equations;
        this.potentialErrorHint = potentialErrorHint;
        // Adjust bounds (if needed)
        Graph.adjustBounds(settings);
        // Generate hash on the raw equation and setting data,
        //  this means that if we extend the settings with new fields pre-existing graphs will have the same hash
        this._hash = calculateHash({ equations, settings });
        // Apply defaults
        this.settings = Object.assign(Object.assign({}, DEFAULT_GRAPH_SETTINGS), settings);
        // Validate settings
        Graph.validateSettings(this.settings);
        // Apply color override
        if (this.settings.defaultColor) {
            this.equations = this.equations.map((equation) => {
                var _a;
                return (Object.assign({ color: (_a = equation.color) !== null && _a !== void 0 ? _a : this.settings.defaultColor }, equation));
            });
        }
    }
    static parse(source) {
        let potentialErrorHint;
        const split = source.split("---");
        if (split.length > 2) {
            throw new SyntaxError("Too many graph segments, there can only be a singular  '---'");
        }
        // Each (non-blank) line of the equation source contains an equation,
        //  this will always be the last segment
        const equations = split[split.length - 1]
            .split(/\r?\n/g)
            .filter((equation) => equation.trim() !== "")
            .map(Graph.parseEquation)
            .map((result) => {
            if (result.hint) {
                potentialErrorHint = result.hint;
            }
            return result.data;
        });
        // If there is more than one segment then the first one will contain the settings
        const settings = split.length > 1 ? Graph.parseSettings(split[0]) : {};
        return new Graph(equations, settings, potentialErrorHint);
    }
    hash() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._hash;
        });
    }
    static validateSettings(settings) {
        // Check graph is within maximum size
        if ((settings.width && settings.width > MAX_SIZE) || (settings.height && settings.height > MAX_SIZE)) {
            throw new SyntaxError(`Graph size outside of accepted bounds (must be <${MAX_SIZE}x${MAX_SIZE})`);
        }
        // Ensure boundaries are correct
        if (settings.left >= settings.right) {
            throw new SyntaxError(`Right boundary (${settings.right}) must be greater than left boundary (${settings.left})`);
        }
        if (settings.bottom >= settings.top) {
            throw new SyntaxError(`
                Top boundary (${settings.top}) must be greater than bottom boundary (${settings.bottom})
            `);
        }
    }
    static parseEquation(eq) {
        var _a;
        let hint;
        const segments = eq
            .split("|")
            .map((segment) => segment.trim())
            .filter((segment) => segment !== "");
        // First segment is always the equation
        const equation = { equation: ucast(segments.shift()) };
        // The rest of the segments can either be the restriction, style, or color
        //  whilst we recommend putting the restriction first, we accept these in any order.
        for (const segment of segments) {
            const segmentUpperCase = segment.toUpperCase();
            // If this is a `hidden` tag
            if (segmentUpperCase === "HIDDEN") {
                equation.hidden = true;
                continue;
            }
            // If this is a valid style constant
            const style = (_a = parseStringToEnum(LineStyle, segmentUpperCase)) !== null && _a !== void 0 ? _a : parseStringToEnum(PointStyle, segmentUpperCase);
            if (style) {
                if (!equation.style) {
                    equation.style = style;
                }
                else {
                    throw new SyntaxError(`Duplicate style identifiers detected: ${equation.style}, ${segment}`);
                }
                continue;
            }
            // If this is a valid color constant or hex code
            const color = parseColor(segment);
            if (color) {
                if (!equation.color) {
                    equation.color = color;
                }
                else {
                    throw new SyntaxError(`Duplicate color identifiers detected, each equation may only contain a single color code.`);
                }
                continue;
            }
            // If this is a valid label string
            if (segmentUpperCase.startsWith("LABEL:")) {
                const label = segment.split(":").slice(1).join(":").trim();
                if (equation.label === undefined) {
                    if (label === "") {
                        throw new SyntaxError(`Equation label must have a value`);
                    }
                    else {
                        equation.label = label;
                    }
                }
                else {
                    throw new SyntaxError(`Duplicate equation labels detected, each equation may only contain a single label.`);
                }
                continue;
            }
            // If none of the above, assume it is a graph restriction
            if (segment.includes("\\")) {
                // If the restriction included a `\` (the LaTeX control character) then the user may have tried to use the LaTeX syntax in the graph restriction (e.g `\frac{1}{2}`)
                //  Desmos does not allow this but returns a fairly archaic error - "A piecewise expression must have at least one condition."
                const view = document.createElement("span");
                const pre = document.createElement("span");
                pre.innerHTML = "You may have tried to use the LaTeX syntax in the graph restriction (";
                const inner = document.createElement("code");
                inner.innerText = segment;
                const post = document.createElement("span");
                post.innerHTML =
                    "), please use some sort of an alternative (e.g <code>\\frac{1}{2}</code> => <code>1/2</code>) as this is not supported by Desmos.";
                view.appendChild(pre);
                view.appendChild(inner);
                view.appendChild(post);
                hint = { view };
            }
            if (!equation.restrictions) {
                equation.restrictions = [];
            }
            equation.restrictions.push(segment);
        }
        return { data: equation, hint };
    }
    static parseSettings(settings) {
        const graphSettings = {};
        // Settings may be separated by either a newline or semicolon
        settings
            .split(/[;\n]/g)
            .map((setting) => setting.trim())
            .filter((setting) => setting !== "")
            // Extract key-value pairs by splitting on the `=` in each property
            .map((setting) => setting.split("="))
            .forEach((setting) => {
            if (setting.length > 2) {
                throw new SyntaxError(`Too many segments, eaching setting must only contain a maximum of one '=' sign`);
            }
            const key = setting[0].trim();
            const value = setting.length > 1 ? setting[1].trim() : undefined;
            const requiresValue = () => {
                if (value === undefined) {
                    throw new SyntaxError(`Field '${key}' must have a value`);
                }
            };
            switch (key) {
                // Boolean fields
                case "grid": {
                    if (!value) {
                        graphSettings[key] = true;
                    }
                    else {
                        const lower = value.toLowerCase();
                        if (lower !== "true" && lower !== "false") {
                            throw new SyntaxError(`Field '${key}' requres a boolean value 'true'/'false' (omit a value to default to 'true')`);
                        }
                        graphSettings[key] = value === "true" ? true : false;
                    }
                    break;
                }
                // Integer fields
                case "top":
                case "bottom":
                case "left":
                case "right":
                case "width":
                case "height": {
                    requiresValue();
                    const num = parseFloat(value);
                    if (Number.isNaN(num)) {
                        throw new SyntaxError(`Field '${key}' must have an integer (or decimal) value`);
                    }
                    graphSettings[key] = num;
                    break;
                }
                // DegreeMode field
                case "degreeMode": {
                    requiresValue();
                    const mode = parseStringToEnum(DegreeMode, value);
                    if (mode) {
                        graphSettings.degreeMode = mode;
                    }
                    else {
                        throw new SyntaxError(`Field 'degreeMode' must be either 'radians' or 'degrees'`);
                    }
                    break;
                }
                // Color field
                case "defaultColor": {
                    requiresValue();
                    const color = parseColor(value);
                    if (color) {
                        graphSettings.defaultColor = color;
                    }
                    else {
                        throw new SyntaxError(`Field 'defaultColor' must be either a valid hex code or one of: ${Object.keys(ColorConstant).join(", ")}`);
                    }
                    break;
                }
                default: {
                    throw new SyntaxError(`Unrecognised field: ${key}`);
                }
            }
        });
        return graphSettings;
    }
    /** Dynamically adjust graph boundary if the defaults would cause an invalid graph with the settings supplied by the user,
     *  this will not do anything if the adjustment is not required.
     */
    static adjustBounds(settings) {
        if (settings.left !== undefined &&
            settings.right === undefined &&
            settings.left >= DEFAULT_GRAPH_SETTINGS.right) {
            settings.right = settings.left + DEFAULT_GRAPH_WIDTH;
        }
        if (settings.left === undefined &&
            settings.right !== undefined &&
            settings.right <= DEFAULT_GRAPH_SETTINGS.left) {
            settings.left = settings.right - DEFAULT_GRAPH_WIDTH;
        }
        if (settings.bottom !== undefined &&
            settings.top === undefined &&
            settings.bottom >= DEFAULT_GRAPH_SETTINGS.top) {
            settings.top = settings.bottom + DEFAULT_GRAPH_HEIGHT;
        }
        if (settings.bottom === undefined &&
            settings.top !== undefined &&
            settings.top <= DEFAULT_GRAPH_SETTINGS.bottom) {
            settings.bottom = settings.top - DEFAULT_GRAPH_HEIGHT;
        }
        return settings;
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
                    .setDesc(`The directory to save cached graphs in, relative to the vault root (technical note: the graphs will be saved as \`desmos-graph-<hash>.svg\` where the name is a SHA-256 hash of the graph source). Also note that a lot of junk will be saved to this folder, you have been warned.`)
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

/** Parse an SVG into a DOM element */
function parseSVG(svg) {
    return new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
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
    render(graph, el) {
        return __awaiter(this, void 0, void 0, function* () {
            const plugin = this.plugin;
            const settings = plugin.settings;
            const equations = graph.equations;
            const graphSettings = graph.settings;
            const hash = yield graph.hash();
            let cacheFile;
            // If this graph is in the cache then fetch it
            if (settings.cache.enabled) {
                if (settings.cache.location === CacheLocation.Memory && hash in plugin.graphCache) {
                    const data = plugin.graphCache[hash];
                    el.appendChild(parseSVG(data));
                    return;
                }
                else if (settings.cache.location === CacheLocation.Filesystem && settings.cache.directory) {
                    const adapter = plugin.app.vault.adapter;
                    cacheFile = obsidian.normalizePath(`${settings.cache.directory}/desmos-graph-${hash}.svg`);
                    // If this graph is in the cache
                    if (yield adapter.exists(cacheFile)) {
                        const data = yield adapter.read(cacheFile);
                        el.appendChild(parseSVG(data));
                        return;
                    }
                }
            }
            // Parse equations into a series of Desmos expressions
            const expressions = [];
            for (const equation of equations) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const expression = {
                    color: equation.color,
                    label: equation.label,
                    showLabel: equation.label !== undefined,
                };
                if (equation.restrictions) {
                    const restriction = equation.restrictions
                        .map((restriction) => `{${restriction}}`
                        // Escape chars
                        .replaceAll("{", String.raw `\{`)
                        .replaceAll("}", String.raw `\}`)
                        .replaceAll("<=", String.raw `\leq `)
                        .replaceAll(">=", String.raw `\geq `)
                        .replaceAll("<", String.raw `\le `)
                        .replaceAll(">", String.raw `\ge `))
                        .join("");
                    expression.latex = `${equation.equation}${restriction}`;
                }
                else {
                    expression.latex = equation.equation;
                }
                if (equation.style) {
                    if (Object.values(LineStyle).includes(ucast(equation.style))) {
                        expression.lineStyle = equation.style;
                    }
                    else if (Object.values(PointStyle).includes(ucast(equation.style))) {
                        expression.pointStyle = equation.style;
                    }
                }
                // Calling JSON.stringify twice allows us to escape the strings as well,
                //  meaning we can embed it directly into the calculator to undo the first stringification without parsing
                expressions.push(`calculator.setExpression(JSON.parse(${JSON.stringify(JSON.stringify(expression))}));`);
            }
            // Because of the electron sandboxing we have to do this inside an iframe (and regardless this is safer),
            //   otherwise we can't include the desmos API (although it would be nice if they had a REST API of some sort)
            // Interestingly enough, this script functions perfectly fine fully offline - so we could include a vendored copy if need be
            //   (the script gets cached by electron the first time it's used so this isn't a particularly high priority)
            const htmlHead = `<script src="https://www.desmos.com/api/v1.6/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>`;
            const htmlBody = `
            <div id="calculator-${hash}" style="width: ${graphSettings.width}px; height: ${graphSettings.height}px;"></div>
            <script>
                const options = {
                    settingsMenu: false,
                    expressions: false,
                    lockViewPort: true,
                    zoomButtons: false,
                    trace: false,
                    showGrid: ${graphSettings.grid},
                    // Desmos takes a value of 'false' for radians and 'true' for degrees
                    degreeMode: ${graphSettings.degreeMode === DegreeMode.Degrees},
                };

                const calculator = Desmos.GraphingCalculator(document.getElementById("calculator-${hash}"), options);
                calculator.setMathBounds({
                    left: ${graphSettings.left},
                    right: ${graphSettings.right},
                    top: ${graphSettings.top},
                    bottom: ${graphSettings.bottom},
                });

                ${expressions.join("\n")}

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

                calculator.asyncScreenshot({ showLabels: true, format: "svg" }, (data) => {
                    document.body.innerHTML = "";
                    parent.postMessage({ t: "desmos-graph", d: "render", o: "${window.origin}", data, hash: "${hash}" }, "${window.origin}");
                });
            </script>
        `;
            const htmlSrc = `<html><head>${htmlHead}</head><body>${htmlBody}</body>`;
            const iframe = document.createElement("iframe");
            iframe.sandbox.add("allow-scripts"); // enable sandbox mode - this prevents any xss exploits from an untrusted source in the frame (and prevents it from accessing the parent)
            iframe.width = graphSettings.width.toString();
            iframe.height = graphSettings.height.toString();
            iframe.style.border = "none";
            iframe.scrolling = "no"; // fixme use a non-depreciated function
            iframe.srcdoc = htmlSrc;
            // iframe.style.display = "none"; // fixme hiding the iframe breaks the positioning
            el.appendChild(iframe);
            return new Promise((resolve) => this.rendering.set(hash, { graph, el, resolve, cacheFile }));
        });
    }
    handler(message) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (message.data.o === window.origin && message.data.t === "desmos-graph") {
                const state = this.rendering.get(message.data.hash);
                if (state) {
                    const { graph, el, resolve, cacheFile } = state;
                    el.empty();
                    if (message.data.d === "error") {
                        renderError(message.data.data, el, (_a = graph.potentialErrorHint) === null || _a === void 0 ? void 0 : _a.view);
                        resolve(); // let caller know we are done rendering
                    }
                    else if (message.data.d === "render") {
                        const { data } = message.data;
                        el.appendChild(parseSVG(data));
                        resolve(); // let caller know we are done rendering
                        const plugin = this.plugin;
                        const settings = plugin.settings;
                        const hash = yield graph.hash();
                        if (settings.cache.enabled) {
                            if (settings.cache.location === CacheLocation.Memory) {
                                plugin.graphCache[hash] = data;
                            }
                            else if (settings.cache.location === CacheLocation.Filesystem) {
                                const adapter = plugin.app.vault.adapter;
                                if (cacheFile && settings.cache.directory) {
                                    if (yield adapter.exists(settings.cache.directory)) {
                                        yield adapter.write(cacheFile, data);
                                    }
                                    else {
                                        new obsidian.Notice(`desmos-graph: target cache directory '${settings.cache.directory}' does not exist, skipping cache`, 10000);
                                    }
                                }
                                else {
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
                    const graph = Graph.parse(source);
                    yield this.renderer.render(graph, el);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy91dGlscy50cyIsInNyYy9ncmFwaC9pbnRlcmZhY2UudHMiLCJzcmMvZ3JhcGgvcGFyc2VyLnRzIiwic3JjL2Vycm9yLnRzIiwic3JjL3NldHRpbmdzLnRzIiwic3JjL3JlbmRlcmVyLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOm51bGwsIm5hbWVzIjpbIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwibm9ybWFsaXplUGF0aCIsIk5vdGljZSIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUF1REE7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDaEgsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxVQUFVLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDL0QsUUFBUSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ25HLFFBQVEsU0FBUyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ3RHLFFBQVEsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxFQUFFO0FBQ3RILFFBQVEsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLFVBQVUsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzlFLEtBQUssQ0FBQyxDQUFDO0FBQ1A7O0FDM0VBO1NBQ3NCLGFBQWEsQ0FBSSxHQUFNOztRQUN6QyxNQUFNLElBQUksR0FBRyxJQUFJLFdBQVcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDM0QsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDM0QsTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDOztRQUUvQyxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUV0RSxPQUFPLElBQUksQ0FBQztLQUNmO0NBQUE7QUFF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
