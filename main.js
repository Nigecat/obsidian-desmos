'use strict';

var obsidian = require('obsidian');

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () {
                        return e[k];
                    }
                });
            }
        });
    }
    n['default'] = e;
    return Object.freeze(n);
}

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
        /* istanbul ignore if */
        if (typeof crypto !== "undefined") {
            const buffer = yield crypto.subtle.digest("SHA-256", data);
            const raw = Array.from(new Uint8Array(buffer));
            // Convery binary hash to hex
            const hash = raw.map((b) => b.toString(16).padStart(2, "0")).join("");
            return hash;
        }
        else {
            // Use node `crypto` module as fallback when browser subtle crypto does not exist,
            // this primarily exists to allow tests to generate hashes, and will not function if used in the browser context
            const { createHash } = yield Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require('crypto')); });
            return createHash("sha256").update(data).digest("hex");
        }
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
    width: "600px",
    height: "400px",
    left: -10,
    right: 10,
    bottom: -7,
    top: 7,
    grid: true,
    skipCache: false,
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
        //! I MOVED THE SIZE VALIDATION INTO THE PARSING STEP AS PART OF THE parseSize FUNCTION
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
    static parseSize(cssString) {
        cssString = cssString.toString();
        let index = cssString.search(/[A-Za-z%]/);
        let number;
        if (number && number > MAX_SIZE) {
            throw new SyntaxError(`Graph size outside of accepted bounds (must be <${MAX_SIZE}x${MAX_SIZE})`);
        }
        let unit;
        if (index != -1) {
            number = parseFloat(cssString.substring(0, index));
            unit = cssString.substring(index);
        }
        else {
            number = parseFloat(cssString);
            unit = "px";
        }
        return { value: number.toString() + unit, isDynamic: unit == "%" };
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
            // Prevent duplicate keys
            if (key in graphSettings) {
                throw new SyntaxError(`Duplicate key '${key}' not allowed`);
            }
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
                case "skipCache": {
                    graphSettings.skipCache = value ? (value.toLowerCase() == "true") : false;
                }
                // Integer fields
                case "top":
                case "bottom":
                case "left":
                case "right": {
                    requiresValue();
                    const num = parseFloat(value);
                    if (Number.isNaN(num)) {
                        throw new SyntaxError(`Field '${key}' must have an integer (or decimal) value`);
                    }
                    graphSettings[key] = num;
                    break;
                }
                // String fields
                case "width":
                case "height": {
                    if (value) {
                        let validation = Graph.parseSize(value);
                        graphSettings.skipCache = validation.isDynamic;
                        graphSettings[key] = validation.value;
                    }
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
            if (settings.cache.enabled && !graph.settings.skipCache) {
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
            <div id="calculator-${hash}" style="width: ${graphSettings.width}; height: ${graphSettings.height};"></div>
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
            iframe.className = "desmos-graph";
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
                        const node = parseSVG(data);
                        node.setAttribute("class", "desmos-graph");
                        el.appendChild(node);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy91dGlscy50cyIsInNyYy9ncmFwaC9pbnRlcmZhY2UudHMiLCJzcmMvZ3JhcGgvcGFyc2VyLnRzIiwic3JjL2Vycm9yLnRzIiwic3JjL3NldHRpbmdzLnRzIiwic3JjL3JlbmRlcmVyLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOm51bGwsIm5hbWVzIjpbIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwibm9ybWFsaXplUGF0aCIsIk5vdGljZSIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXVEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxL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
