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
                const expression = {};
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
                if (equation.color) {
                    expression.color = equation.color;
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
