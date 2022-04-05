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

/** Unsafe cast method.
 *  Will transform the given type `F` into `T`,
 *      use only when you know this will be valid. */
function ucast(o) {
    return o;
}

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
    ColorConstant["Purple"] = "#cc8899";
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
        value = value.slice(1);
        // Ensure the rest of the value is a valid alphanumeric string
        if (/^[0-9a-zA-Z]+$/.test(value)) {
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
        // Check graph is within maximum size
        if ((settings.width && settings.width > MAX_SIZE) || (settings.height && settings.height > MAX_SIZE)) {
            throw new SyntaxError(`Graph size outside of accepted bounds (must be <${MAX_SIZE}x${MAX_SIZE})`);
        }
        // Dynamically adjust graph boundary if the defaults would cause an invalid graph with the settings supplied by the user
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
        this.settings = Object.assign(Object.assign({}, DEFAULT_GRAPH_SETTINGS), settings);
        // Ensure boundaries are complete and in order
        if (this.settings.left >= this.settings.right) {
            throw new SyntaxError(`Right boundary (${this.settings.right}) must be greater than left boundary (${this.settings.left})`);
        }
        if (this.settings.bottom >= this.settings.top) {
            throw new SyntaxError(`
                Top boundary (${this.settings.top}) must be greater than bottom boundary (${this.settings.bottom})
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
            const expectedType = typeof DEFAULT_GRAPH_SETTINGS[key];
            if (key in DEFAULT_GRAPH_SETTINGS) {
                // Boolean fields default to `true` so do not require a value
                if (expectedType !== "boolean" && !value) {
                    throw new SyntaxError(`Field '${key}' must have a value`);
                }
                switch (expectedType) {
                    case "number": {
                        const num = parseFloat(value);
                        if (Number.isNaN(num)) {
                            throw new SyntaxError(`Field '${key}' must have an integer (or decimal) value`);
                        }
                        graphSettings[key] = num;
                        break;
                    }
                    case "boolean": {
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
                    default: {
                        throw new SyntaxError(`Got unrecognized field type ${key} with value ${value}, this is a bug.`);
                    }
                }
            }
            else {
                throw new SyntaxError(`Unrecognised field: ${key}`);
            }
        });
        return graphSettings;
    }
    static parse(source) {
        let potentialErrorHint;
        const split = source.split("---");
        if (split.length > 2) {
            throw new SyntaxError("Too many graph segments"); // todo - write meaninful error message
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
            if (this._hash) {
                return this._hash;
            }
            // If hash not in cache then calculate it
            this._hash = yield calculateHash(this);
            return this._hash;
        });
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

                calculator.asyncScreenshot({ showLabels: true, format: "png" }, (data) => {
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
        return __awaiter(this, void 0, void 0, function* () {
            if (message.data.o === window.origin && message.data.t === "desmos-graph") {
                const state = this.rendering.get(message.data.hash);
                if (state) {
                    const { graph, el, resolve, cacheFile } = state;
                    el.empty();
                    if (message.data.d === "error") {
                        if (graph.potentialErrorHint) {
                            renderError(message.data.data, el, graph.potentialErrorHint.view);
                        }
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
                        const hash = yield graph.hash();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy91dGlscy50cyIsInNyYy9oYXNoLnRzIiwic3JjL2dyYXBoL2ludGVyZmFjZS50cyIsInNyYy9ncmFwaC9wYXJzZXIudHMiLCJzcmMvZXJyb3IudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXHJcblxyXG5QZXJtaXNzaW9uIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBhbmQvb3IgZGlzdHJpYnV0ZSB0aGlzIHNvZnR3YXJlIGZvciBhbnlcclxucHVycG9zZSB3aXRoIG9yIHdpdGhvdXQgZmVlIGlzIGhlcmVieSBncmFudGVkLlxyXG5cclxuVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiBBTkQgVEhFIEFVVEhPUiBESVNDTEFJTVMgQUxMIFdBUlJBTlRJRVMgV0lUSFxyXG5SRUdBUkQgVE8gVEhJUyBTT0ZUV0FSRSBJTkNMVURJTkcgQUxMIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFlcclxuQU5EIEZJVE5FU1MuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1IgQkUgTElBQkxFIEZPUiBBTlkgU1BFQ0lBTCwgRElSRUNULFxyXG5JTkRJUkVDVCwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIE9SIEFOWSBEQU1BR0VTIFdIQVRTT0VWRVIgUkVTVUxUSU5HIEZST01cclxuTE9TUyBPRiBVU0UsIERBVEEgT1IgUFJPRklUUywgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIE5FR0xJR0VOQ0UgT1JcclxuT1RIRVIgVE9SVElPVVMgQUNUSU9OLCBBUklTSU5HIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFVTRSBPUlxyXG5QRVJGT1JNQU5DRSBPRiBUSElTIFNPRlRXQVJFLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG4vKiBnbG9iYWwgUmVmbGVjdCwgUHJvbWlzZSAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSkge1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0Lm1ldGFkYXRhID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBSZWZsZWN0Lm1ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXRlcih0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2dlbmVyYXRvcih0aGlzQXJnLCBib2R5KSB7XHJcbiAgICB2YXIgXyA9IHsgbGFiZWw6IDAsIHNlbnQ6IGZ1bmN0aW9uKCkgeyBpZiAodFswXSAmIDEpIHRocm93IHRbMV07IHJldHVybiB0WzFdOyB9LCB0cnlzOiBbXSwgb3BzOiBbXSB9LCBmLCB5LCB0LCBnO1xyXG4gICAgcmV0dXJuIGcgPSB7IG5leHQ6IHZlcmIoMCksIFwidGhyb3dcIjogdmVyYigxKSwgXCJyZXR1cm5cIjogdmVyYigyKSB9LCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKF8pIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChmID0gMSwgeSAmJiAodCA9IG9wWzBdICYgMiA/IHlbXCJyZXR1cm5cIl0gOiBvcFswXSA/IHlbXCJ0aHJvd1wiXSB8fCAoKHQgPSB5W1wicmV0dXJuXCJdKSAmJiB0LmNhbGwoeSksIDApIDogeS5uZXh0KSAmJiAhKHQgPSB0LmNhbGwoeSwgb3BbMV0pKS5kb25lKSByZXR1cm4gdDtcclxuICAgICAgICAgICAgaWYgKHkgPSAwLCB0KSBvcCA9IFtvcFswXSAmIDIsIHQudmFsdWVdO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKG9wWzBdKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDA6IGNhc2UgMTogdCA9IG9wOyBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgNDogXy5sYWJlbCsrOyByZXR1cm4geyB2YWx1ZTogb3BbMV0sIGRvbmU6IGZhbHNlIH07XHJcbiAgICAgICAgICAgICAgICBjYXNlIDU6IF8ubGFiZWwrKzsgeSA9IG9wWzFdOyBvcCA9IFswXTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDc6IG9wID0gXy5vcHMucG9wKCk7IF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghKHQgPSBfLnRyeXMsIHQgPSB0Lmxlbmd0aCA+IDAgJiYgdFt0Lmxlbmd0aCAtIDFdKSAmJiAob3BbMF0gPT09IDYgfHwgb3BbMF0gPT09IDIpKSB7IF8gPSAwOyBjb250aW51ZTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gMyAmJiAoIXQgfHwgKG9wWzFdID4gdFswXSAmJiBvcFsxXSA8IHRbM10pKSkgeyBfLmxhYmVsID0gb3BbMV07IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSA2ICYmIF8ubGFiZWwgPCB0WzFdKSB7IF8ubGFiZWwgPSB0WzFdOyB0ID0gb3A7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHQgJiYgXy5sYWJlbCA8IHRbMl0pIHsgXy5sYWJlbCA9IHRbMl07IF8ub3BzLnB1c2gob3ApOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0WzJdKSBfLm9wcy5wb3AoKTtcclxuICAgICAgICAgICAgICAgICAgICBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG9wID0gYm9keS5jYWxsKHRoaXNBcmcsIF8pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgb3AgPSBbNiwgZV07IHkgPSAwOyB9IGZpbmFsbHkgeyBmID0gdCA9IDA7IH1cclxuICAgICAgICBpZiAob3BbMF0gJiA1KSB0aHJvdyBvcFsxXTsgcmV0dXJuIHsgdmFsdWU6IG9wWzBdID8gb3BbMV0gOiB2b2lkIDAsIGRvbmU6IHRydWUgfTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2NyZWF0ZUJpbmRpbmcgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIGsyLCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH0pO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IGZyb20pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpZiAoZ1tuXSkgaVtuXSA9IGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAoYSwgYikgeyBxLnB1c2goW24sIHYsIGEsIGJdKSA+IDEgfHwgcmVzdW1lKG4sIHYpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IG4gPT09IFwicmV0dXJuXCIgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0U3Rhcihtb2QpIHtcclxuICAgIGlmIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpIHJldHVybiBtb2Q7XHJcbiAgICB2YXIgcmVzdWx0ID0ge307XHJcbiAgICBpZiAobW9kICE9IG51bGwpIGZvciAodmFyIGsgaW4gbW9kKSBpZiAoayAhPT0gXCJkZWZhdWx0XCIgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG1vZCwgaykpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwgayk7XHJcbiAgICBfX3NldE1vZHVsZURlZmF1bHQocmVzdWx0LCBtb2QpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0RGVmYXVsdChtb2QpIHtcclxuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgZGVmYXVsdDogbW9kIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XHJcbn1cclxuIiwiLyoqIFVuc2FmZSBjYXN0IG1ldGhvZC5cbiAqICBXaWxsIHRyYW5zZm9ybSB0aGUgZ2l2ZW4gdHlwZSBgRmAgaW50byBgVGAsXG4gKiAgICAgIHVzZSBvbmx5IHdoZW4geW91IGtub3cgdGhpcyB3aWxsIGJlIHZhbGlkLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVjYXN0PEYsIFQ+KG86IEYpOiBUIHtcbiAgICByZXR1cm4gbyBhcyB1bmtub3duIGFzIFQ7XG59XG4iLCJleHBvcnQgdHlwZSBIYXNoID0gc3RyaW5nO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsY3VsYXRlSGFzaDxUPih2YWw6IFQpOiBQcm9taXNlPEhhc2g+IHtcbiAgICBjb25zdCBkYXRhID0gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKEpTT04uc3RyaW5naWZ5KHZhbCkpO1xuICAgIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IGNyeXB0by5zdWJ0bGUuZGlnZXN0KFwiU0hBLTI1NlwiLCBkYXRhKTtcbiAgICBjb25zdCByYXcgPSBBcnJheS5mcm9tKG5ldyBVaW50OEFycmF5KGJ1ZmZlcikpO1xuICAgIC8vIENvbnZlcnkgYmluYXJ5IGhhc2ggdG8gaGV4XG4gICAgY29uc3QgaGFzaCA9IHJhdy5tYXAoKGIpID0+IGIudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsIFwiMFwiKSkuam9pbihcIlwiKTtcblxuICAgIHJldHVybiBoYXNoO1xufVxuIiwiZXhwb3J0IGludGVyZmFjZSBHcmFwaFNldHRpbmdzIHtcbiAgICAvKiogVGhlIHdpZHRoIG9mIHRoZSByZW5kZXJlZCBncmFvaCAqL1xuICAgIHdpZHRoOiBudW1iZXI7XG4gICAgLyoqIFRoZSBoZWlnaHQgb2YgdGhlIHJlbmRlcmVkIGdyYXBoICovXG4gICAgaGVpZ2h0OiBudW1iZXI7XG4gICAgLyoqIFRoZSBsZWZ0IGJvdW5kIG9mIHRoZSBncmFwaCAqL1xuICAgIGxlZnQ6IG51bWJlcjtcbiAgICAvKiogVGhlIHJpZ2h0IGJvdW5kIG9mIHRoZSBncmFwaCAqL1xuICAgIHJpZ2h0OiBudW1iZXI7XG4gICAgLyoqIFRoZSBib3R0b20gYm91bmQgb2YgdGhlIGdyYXBoICovXG4gICAgYm90dG9tOiBudW1iZXI7XG4gICAgLyoqIFRoZSB0b3AgYm91bmQgb2YgdGhlIGdyYXBoICovXG4gICAgdG9wOiBudW1iZXI7XG4gICAgLyoqIFdoZXRoZXIgdG8gc2hvdyB0aGUgZ3JpZCBvciBub3QsIGRlZmF1bHRzIHRvIGB0cnVlYCAqL1xuICAgIGdyaWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXF1YXRpb24ge1xuICAgIGVxdWF0aW9uOiBzdHJpbmc7XG4gICAgcmVzdHJpY3Rpb25zPzogc3RyaW5nW107XG4gICAgc3R5bGU/OiBMaW5lU3R5bGUgfCBQb2ludFN0eWxlO1xuICAgIGNvbG9yPzogQ29sb3JDb25zdGFudCB8IEhleENvbG9yO1xuICAgIGhpZGRlbj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBlbnVtIExpbmVTdHlsZSB7XG4gICAgU29saWQgPSBcIlNPTElEXCIsXG4gICAgRGFzaGVkID0gXCJEQVNIRURcIixcbiAgICBEb3R0ZWQgPSBcIkRPVFRFRFwiLFxufVxuXG5leHBvcnQgZW51bSBQb2ludFN0eWxlIHtcbiAgICBQb2ludCA9IFwiUE9JTlRcIixcbiAgICBPcGVuID0gXCJPUEVOXCIsXG4gICAgQ3Jvc3MgPSBcIkNST1NTXCIsXG59XG5cbmV4cG9ydCB0eXBlIEhleENvbG9yID0gc3RyaW5nO1xuXG5leHBvcnQgZW51bSBDb2xvckNvbnN0YW50IHtcbiAgICBSZWQgPSBcIiNmZjAwMDBcIixcbiAgICBHcmVlbiA9IFwiIzAwZmYwMFwiLFxuICAgIEJsdWUgPSBcIiMwMDAwZmZcIixcblxuICAgIFllbGxvdyA9IFwiI2ZmZmYwMFwiLFxuICAgIE1hZ2VudGEgPSBcIiNmZjAwZmZcIixcbiAgICBDeWFuID0gXCIjMDBmZmZmXCIsXG5cbiAgICBQdXJwbGUgPSBcIiNjYzg4OTlcIixcbiAgICBPcmFuZ2UgPSBcIiNmZmE1MDBcIixcbiAgICBCbGFjayA9IFwiIzAwMDAwMFwiLFxuICAgIFdoaXRlID0gXCIjZmZmZmZmXCIsXG59XG4iLCJpbXBvcnQgeyB1Y2FzdCB9IGZyb20gXCIuLi91dGlsc1wiO1xuaW1wb3J0IHsgY2FsY3VsYXRlSGFzaCwgSGFzaCB9IGZyb20gXCIuLi9oYXNoXCI7XG5pbXBvcnQgeyBHcmFwaFNldHRpbmdzLCBFcXVhdGlvbiwgSGV4Q29sb3IsIENvbG9yQ29uc3RhbnQsIExpbmVTdHlsZSwgUG9pbnRTdHlsZSB9IGZyb20gXCIuL2ludGVyZmFjZVwiO1xuXG4vKiogVGhlIG1heGltdW0gZGltZW5zaW9ucyBvZiBhIGdyYXBoICovXG5jb25zdCBNQVhfU0laRSA9IDk5OTk5O1xuXG5jb25zdCBERUZBVUxUX0dSQVBIX1NFVFRJTkdTOiBHcmFwaFNldHRpbmdzID0ge1xuICAgIHdpZHRoOiA2MDAsXG4gICAgaGVpZ2h0OiA0MDAsXG4gICAgbGVmdDogLTEwLFxuICAgIHJpZ2h0OiAxMCxcbiAgICBib3R0b206IC03LFxuICAgIHRvcDogNyxcbiAgICBncmlkOiB0cnVlLFxufTtcblxuY29uc3QgREVGQVVMVF9HUkFQSF9XSURUSCA9IE1hdGguYWJzKERFRkFVTFRfR1JBUEhfU0VUVElOR1MubGVmdCkgKyBNYXRoLmFicyhERUZBVUxUX0dSQVBIX1NFVFRJTkdTLnJpZ2h0KTtcblxuY29uc3QgREVGQVVMVF9HUkFQSF9IRUlHSFQgPSBNYXRoLmFicyhERUZBVUxUX0dSQVBIX1NFVFRJTkdTLmJvdHRvbSkgKyBNYXRoLmFicyhERUZBVUxUX0dSQVBIX1NFVFRJTkdTLnRvcCk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG90ZW50aWFsRXJyb3JIaW50IHtcbiAgICB2aWV3OiBIVE1MU3BhbkVsZW1lbnQ7XG59XG5cbmludGVyZmFjZSBQYXJzZVJlc3VsdDxUPiB7XG4gICAgZGF0YTogVDtcbiAgICBoaW50PzogUG90ZW50aWFsRXJyb3JIaW50O1xufVxuXG5mdW5jdGlvbiBwYXJzZVN0cmluZ1RvRW51bTxWLCBUIGV4dGVuZHMgeyBba2V5OiBzdHJpbmddOiBWIH0+KG9iajogVCwga2V5OiBzdHJpbmcpOiBWIHwgbnVsbCB7XG4gICAgY29uc3Qgb2JqS2V5ID0gT2JqZWN0LmtleXMob2JqKS5maW5kKChrKSA9PiBrLnRvVXBwZXJDYXNlKCkgPT09IGtleS50b1VwcGVyQ2FzZSgpKTtcbiAgICByZXR1cm4gb2JqS2V5ID8gb2JqW29iaktleV0gOiBudWxsO1xufVxuXG5mdW5jdGlvbiBwYXJzZUNvbG9yKHZhbHVlOiBzdHJpbmcpOiBDb2xvckNvbnN0YW50IHwgSGV4Q29sb3IgfCBudWxsIHtcbiAgICAvLyBJZiB0aGUgdmFsdWUgaXMgYSB2YWxpZCBoZXggY29sb3VyXG4gICAgaWYgKHZhbHVlLnN0YXJ0c1dpdGgoXCIjXCIpKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUuc2xpY2UoMSk7XG4gICAgICAgIC8vIEVuc3VyZSB0aGUgcmVzdCBvZiB0aGUgdmFsdWUgaXMgYSB2YWxpZCBhbHBoYW51bWVyaWMgc3RyaW5nXG4gICAgICAgIGlmICgvXlswLTlhLXpBLVpdKyQvLnRlc3QodmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUgYXMgSGV4Q29sb3I7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgdmFsdWUgaXMgYSB2YWxpZCBjb2xvdXIgY29uc3RhbnRcbiAgICByZXR1cm4gcGFyc2VTdHJpbmdUb0VudW0oQ29sb3JDb25zdGFudCwgdmFsdWUpO1xufVxuXG5leHBvcnQgY2xhc3MgR3JhcGgge1xuICAgIHByaXZhdGUgX2hhc2g/OiBIYXNoO1xuXG4gICAgcHVibGljIHJlYWRvbmx5IGVxdWF0aW9uczogRXF1YXRpb25bXTtcbiAgICBwdWJsaWMgcmVhZG9ubHkgc2V0dGluZ3M6IEdyYXBoU2V0dGluZ3M7XG5cbiAgICAvKiogIFN1cHBsZW1lbnRhcnkgZXJyb3IgaW5mb3JtYXRpb24gaWYgdGhlIHNvdXJjZSBpZiB2YWxpZCBidXQgRGVzbW9zIHJldHVybnMgYW4gZXJyb3IgKi9cbiAgICBwdWJsaWMgcmVhZG9ubHkgcG90ZW50aWFsRXJyb3JIaW50PzogUG90ZW50aWFsRXJyb3JIaW50O1xuXG4gICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICBlcXVhdGlvbnM6IEVxdWF0aW9uW10sXG4gICAgICAgIHNldHRpbmdzOiBQYXJ0aWFsPEdyYXBoU2V0dGluZ3M+LFxuICAgICAgICBwb3RlbnRpYWxFcnJvckhpbnQ/OiBQb3RlbnRpYWxFcnJvckhpbnRcbiAgICApIHtcbiAgICAgICAgdGhpcy5lcXVhdGlvbnMgPSBlcXVhdGlvbnM7XG4gICAgICAgIHRoaXMucG90ZW50aWFsRXJyb3JIaW50ID0gcG90ZW50aWFsRXJyb3JIaW50O1xuXG4gICAgICAgIC8vIENoZWNrIGdyYXBoIGlzIHdpdGhpbiBtYXhpbXVtIHNpemVcbiAgICAgICAgaWYgKChzZXR0aW5ncy53aWR0aCAmJiBzZXR0aW5ncy53aWR0aCA+IE1BWF9TSVpFKSB8fCAoc2V0dGluZ3MuaGVpZ2h0ICYmIHNldHRpbmdzLmhlaWdodCA+IE1BWF9TSVpFKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBHcmFwaCBzaXplIG91dHNpZGUgb2YgYWNjZXB0ZWQgYm91bmRzIChtdXN0IGJlIDwke01BWF9TSVpFfXgke01BWF9TSVpFfSlgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIER5bmFtaWNhbGx5IGFkanVzdCBncmFwaCBib3VuZGFyeSBpZiB0aGUgZGVmYXVsdHMgd291bGQgY2F1c2UgYW4gaW52YWxpZCBncmFwaCB3aXRoIHRoZSBzZXR0aW5ncyBzdXBwbGllZCBieSB0aGUgdXNlclxuICAgICAgICBpZiAoXG4gICAgICAgICAgICBzZXR0aW5ncy5sZWZ0ICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIHNldHRpbmdzLnJpZ2h0ID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIHNldHRpbmdzLmxlZnQgPj0gREVGQVVMVF9HUkFQSF9TRVRUSU5HUy5yaWdodFxuICAgICAgICApIHtcbiAgICAgICAgICAgIHNldHRpbmdzLnJpZ2h0ID0gc2V0dGluZ3MubGVmdCArIERFRkFVTFRfR1JBUEhfV0lEVEg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgc2V0dGluZ3MubGVmdCA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBzZXR0aW5ncy5yaWdodCAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBzZXR0aW5ncy5yaWdodCA8PSBERUZBVUxUX0dSQVBIX1NFVFRJTkdTLmxlZnRcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBzZXR0aW5ncy5sZWZ0ID0gc2V0dGluZ3MucmlnaHQgLSBERUZBVUxUX0dSQVBIX1dJRFRIO1xuICAgICAgICB9XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIHNldHRpbmdzLmJvdHRvbSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBzZXR0aW5ncy50b3AgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgc2V0dGluZ3MuYm90dG9tID49IERFRkFVTFRfR1JBUEhfU0VUVElOR1MudG9wXG4gICAgICAgICkge1xuICAgICAgICAgICAgc2V0dGluZ3MudG9wID0gc2V0dGluZ3MuYm90dG9tICsgREVGQVVMVF9HUkFQSF9IRUlHSFQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgc2V0dGluZ3MuYm90dG9tID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIHNldHRpbmdzLnRvcCAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBzZXR0aW5ncy50b3AgPD0gREVGQVVMVF9HUkFQSF9TRVRUSU5HUy5ib3R0b21cbiAgICAgICAgKSB7XG4gICAgICAgICAgICBzZXR0aW5ncy5ib3R0b20gPSBzZXR0aW5ncy50b3AgLSBERUZBVUxUX0dSQVBIX0hFSUdIVDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfR1JBUEhfU0VUVElOR1MsIC4uLnNldHRpbmdzIH07XG5cbiAgICAgICAgLy8gRW5zdXJlIGJvdW5kYXJpZXMgYXJlIGNvbXBsZXRlIGFuZCBpbiBvcmRlclxuICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy5sZWZ0ID49IHRoaXMuc2V0dGluZ3MucmlnaHQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcbiAgICAgICAgICAgICAgICBgUmlnaHQgYm91bmRhcnkgKCR7dGhpcy5zZXR0aW5ncy5yaWdodH0pIG11c3QgYmUgZ3JlYXRlciB0aGFuIGxlZnQgYm91bmRhcnkgKCR7dGhpcy5zZXR0aW5ncy5sZWZ0fSlgXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnNldHRpbmdzLmJvdHRvbSA+PSB0aGlzLnNldHRpbmdzLnRvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBcbiAgICAgICAgICAgICAgICBUb3AgYm91bmRhcnkgKCR7dGhpcy5zZXR0aW5ncy50b3B9KSBtdXN0IGJlIGdyZWF0ZXIgdGhhbiBib3R0b20gYm91bmRhcnkgKCR7dGhpcy5zZXR0aW5ncy5ib3R0b219KVxuICAgICAgICAgICAgYCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRpYyBwYXJzZUVxdWF0aW9uKGVxOiBzdHJpbmcpOiBQYXJzZVJlc3VsdDxFcXVhdGlvbj4ge1xuICAgICAgICBsZXQgaGludDtcblxuICAgICAgICBjb25zdCBzZWdtZW50cyA9IGVxXG4gICAgICAgICAgICAuc3BsaXQoXCJ8XCIpXG4gICAgICAgICAgICAubWFwKChzZWdtZW50KSA9PiBzZWdtZW50LnRyaW0oKSlcbiAgICAgICAgICAgIC5maWx0ZXIoKHNlZ21lbnQpID0+IHNlZ21lbnQgIT09IFwiXCIpO1xuXG4gICAgICAgIC8vIEZpcnN0IHNlZ21lbnQgaXMgYWx3YXlzIHRoZSBlcXVhdGlvblxuICAgICAgICBjb25zdCBlcXVhdGlvbjogRXF1YXRpb24gPSB7IGVxdWF0aW9uOiB1Y2FzdChzZWdtZW50cy5zaGlmdCgpKSB9O1xuXG4gICAgICAgIC8vIFRoZSByZXN0IG9mIHRoZSBzZWdtZW50cyBjYW4gZWl0aGVyIGJlIHRoZSByZXN0cmljdGlvbiwgc3R5bGUsIG9yIGNvbG9yXG4gICAgICAgIC8vICB3aGlsc3Qgd2UgcmVjb21tZW5kIHB1dHRpbmcgdGhlIHJlc3RyaWN0aW9uIGZpcnN0LCB3ZSBhY2NlcHQgdGhlc2UgaW4gYW55IG9yZGVyLlxuICAgICAgICBmb3IgKGNvbnN0IHNlZ21lbnQgb2Ygc2VnbWVudHMpIHtcbiAgICAgICAgICAgIGNvbnN0IHNlZ21lbnRVcHBlckNhc2UgPSBzZWdtZW50LnRvVXBwZXJDYXNlKCk7XG5cbiAgICAgICAgICAgIC8vIElmIHRoaXMgaXMgYSBgaGlkZGVuYCB0YWdcbiAgICAgICAgICAgIGlmIChzZWdtZW50VXBwZXJDYXNlID09PSBcIkhJRERFTlwiKSB7XG4gICAgICAgICAgICAgICAgZXF1YXRpb24uaGlkZGVuID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgdGhpcyBpcyBhIHZhbGlkIHN0eWxlIGNvbnN0YW50XG4gICAgICAgICAgICBjb25zdCBzdHlsZTogTGluZVN0eWxlIHwgUG9pbnRTdHlsZSB8IG51bGwgPVxuICAgICAgICAgICAgICAgIHBhcnNlU3RyaW5nVG9FbnVtKExpbmVTdHlsZSwgc2VnbWVudFVwcGVyQ2FzZSkgPz8gcGFyc2VTdHJpbmdUb0VudW0oUG9pbnRTdHlsZSwgc2VnbWVudFVwcGVyQ2FzZSk7XG4gICAgICAgICAgICBpZiAoc3R5bGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVxdWF0aW9uLnN0eWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIGVxdWF0aW9uLnN0eWxlID0gc3R5bGU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBEdXBsaWNhdGUgc3R5bGUgaWRlbnRpZmllcnMgZGV0ZWN0ZWQ6ICR7ZXF1YXRpb24uc3R5bGV9LCAke3NlZ21lbnR9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiB0aGlzIGlzIGEgdmFsaWQgY29sb3IgY29uc3RhbnQgb3IgaGV4IGNvZGVcbiAgICAgICAgICAgIGNvbnN0IGNvbG9yID0gcGFyc2VDb2xvcihzZWdtZW50KTtcbiAgICAgICAgICAgIGlmIChjb2xvcikge1xuICAgICAgICAgICAgICAgIGlmICghZXF1YXRpb24uY29sb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgZXF1YXRpb24uY29sb3IgPSBjb2xvcjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICBgRHVwbGljYXRlIGNvbG9yIGlkZW50aWZpZXJzIGRldGVjdGVkLCBlYWNoIGVxdWF0aW9uIG1heSBvbmx5IGNvbnRhaW4gYSBzaW5nbGUgY29sb3IgY29kZS5gXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiBub25lIG9mIHRoZSBhYm92ZSwgYXNzdW1lIGl0IGlzIGEgZ3JhcGggcmVzdHJpY3Rpb25cbiAgICAgICAgICAgIGlmIChzZWdtZW50LmluY2x1ZGVzKFwiXFxcXFwiKSkge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSByZXN0cmljdGlvbiBpbmNsdWRlZCBhIGBcXGAgKHRoZSBMYVRlWCBjb250cm9sIGNoYXJhY3RlcikgdGhlbiB0aGUgdXNlciBtYXkgaGF2ZSB0cmllZCB0byB1c2UgdGhlIExhVGVYIHN5bnRheCBpbiB0aGUgZ3JhcGggcmVzdHJpY3Rpb24gKGUuZyBgXFxmcmFjezF9ezJ9YClcbiAgICAgICAgICAgICAgICAvLyAgRGVzbW9zIGRvZXMgbm90IGFsbG93IHRoaXMgYnV0IHJldHVybnMgYSBmYWlybHkgYXJjaGFpYyBlcnJvciAtIFwiQSBwaWVjZXdpc2UgZXhwcmVzc2lvbiBtdXN0IGhhdmUgYXQgbGVhc3Qgb25lIGNvbmRpdGlvbi5cIlxuICAgICAgICAgICAgICAgIGNvbnN0IHZpZXcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICAgICAgICAgICAgICBwcmUuaW5uZXJIVE1MID0gXCJZb3UgbWF5IGhhdmUgdHJpZWQgdG8gdXNlIHRoZSBMYVRlWCBzeW50YXggaW4gdGhlIGdyYXBoIHJlc3RyaWN0aW9uIChcIjtcbiAgICAgICAgICAgICAgICBjb25zdCBpbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjb2RlXCIpO1xuICAgICAgICAgICAgICAgIGlubmVyLmlubmVyVGV4dCA9IHNlZ21lbnQ7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgICAgICAgICAgICAgIHBvc3QuaW5uZXJIVE1MID1cbiAgICAgICAgICAgICAgICAgICAgXCIpLCBwbGVhc2UgdXNlIHNvbWUgc29ydCBvZiBhbiBhbHRlcm5hdGl2ZSAoZS5nIDxjb2RlPlxcXFxmcmFjezF9ezJ9PC9jb2RlPiA9PiA8Y29kZT4xLzI8L2NvZGU+KSBhcyB0aGlzIGlzIG5vdCBzdXBwb3J0ZWQgYnkgRGVzbW9zLlwiO1xuICAgICAgICAgICAgICAgIHZpZXcuYXBwZW5kQ2hpbGQocHJlKTtcbiAgICAgICAgICAgICAgICB2aWV3LmFwcGVuZENoaWxkKGlubmVyKTtcbiAgICAgICAgICAgICAgICB2aWV3LmFwcGVuZENoaWxkKHBvc3QpO1xuICAgICAgICAgICAgICAgIGhpbnQgPSB7IHZpZXcgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFlcXVhdGlvbi5yZXN0cmljdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBlcXVhdGlvbi5yZXN0cmljdGlvbnMgPSBbXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZXF1YXRpb24ucmVzdHJpY3Rpb25zLnB1c2goc2VnbWVudCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyBkYXRhOiBlcXVhdGlvbiwgaGludCB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdGljIHBhcnNlU2V0dGluZ3Moc2V0dGluZ3M6IHN0cmluZyk6IFBhcnRpYWw8R3JhcGhTZXR0aW5ncz4ge1xuICAgICAgICBjb25zdCBncmFwaFNldHRpbmdzOiBQYXJ0aWFsPEdyYXBoU2V0dGluZ3M+ID0ge307XG5cbiAgICAgICAgLy8gU2V0dGluZ3MgbWF5IGJlIHNlcGFyYXRlZCBieSBlaXRoZXIgYSBuZXdsaW5lIG9yIHNlbWljb2xvblxuICAgICAgICBzZXR0aW5nc1xuICAgICAgICAgICAgLnNwbGl0KC9bO1xcbl0vZylcbiAgICAgICAgICAgIC5tYXAoKHNldHRpbmcpID0+IHNldHRpbmcudHJpbSgpKVxuICAgICAgICAgICAgLmZpbHRlcigoc2V0dGluZykgPT4gc2V0dGluZyAhPT0gXCJcIilcbiAgICAgICAgICAgIC8vIEV4dHJhY3Qga2V5LXZhbHVlIHBhaXJzIGJ5IHNwbGl0dGluZyBvbiB0aGUgYD1gIGluIGVhY2ggcHJvcGVydHlcbiAgICAgICAgICAgIC5tYXAoKHNldHRpbmcpID0+IHNldHRpbmcuc3BsaXQoXCI9XCIpKVxuICAgICAgICAgICAgLmZvckVhY2goKHNldHRpbmcpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoc2V0dGluZy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVG9vIG1hbnkgc2VnbWVudHMsIGVhY2hpbmcgc2V0dGluZyBtdXN0IG9ubHkgY29udGFpbiBhIG1heGltdW0gb2Ygb25lICc9JyBzaWduYCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3Qga2V5ID0gc2V0dGluZ1swXS50cmltKCkgYXMga2V5b2YgR3JhcGhTZXR0aW5ncztcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHNldHRpbmcubGVuZ3RoID4gMSA/IHNldHRpbmdbMV0udHJpbSgpIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4cGVjdGVkVHlwZSA9IHR5cGVvZiBERUZBVUxUX0dSQVBIX1NFVFRJTkdTW2tleV07XG5cbiAgICAgICAgICAgICAgICBpZiAoa2V5IGluIERFRkFVTFRfR1JBUEhfU0VUVElOR1MpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQm9vbGVhbiBmaWVsZHMgZGVmYXVsdCB0byBgdHJ1ZWAgc28gZG8gbm90IHJlcXVpcmUgYSB2YWx1ZVxuICAgICAgICAgICAgICAgICAgICBpZiAoZXhwZWN0ZWRUeXBlICE9PSBcImJvb2xlYW5cIiAmJiAhdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgRmllbGQgJyR7a2V5fScgbXVzdCBoYXZlIGEgdmFsdWVgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoZXhwZWN0ZWRUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwibnVtYmVyXCI6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBudW0gPSBwYXJzZUZsb2F0KHZhbHVlIGFzIHN0cmluZyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKE51bWJlci5pc05hTihudW0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgRmllbGQgJyR7a2V5fScgbXVzdCBoYXZlIGFuIGludGVnZXIgKG9yIGRlY2ltYWwpIHZhbHVlYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChncmFwaFNldHRpbmdzW2tleV0gYXMgbnVtYmVyKSA9IG51bTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBcImJvb2xlYW5cIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGdyYXBoU2V0dGluZ3Nba2V5XSBhcyBib29sZWFuKSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbG93ZXIgPSB2YWx1ZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobG93ZXIgIT09IFwidHJ1ZVwiICYmIGxvd2VyICE9PSBcImZhbHNlXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgRmllbGQgJyR7a2V5fScgcmVxdXJlcyBhIGJvb2xlYW4gdmFsdWUgJ3RydWUnLydmYWxzZScgKG9taXQgYSB2YWx1ZSB0byBkZWZhdWx0IHRvICd0cnVlJylgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGdyYXBoU2V0dGluZ3Nba2V5XSBhcyBib29sZWFuKSA9IHZhbHVlID09PSBcInRydWVcIiA/IHRydWUgOiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBHb3QgdW5yZWNvZ25pemVkIGZpZWxkIHR5cGUgJHtrZXl9IHdpdGggdmFsdWUgJHt2YWx1ZX0sIHRoaXMgaXMgYSBidWcuYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVucmVjb2duaXNlZCBmaWVsZDogJHtrZXl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGdyYXBoU2V0dGluZ3M7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBwYXJzZShzb3VyY2U6IHN0cmluZyk6IEdyYXBoIHtcbiAgICAgICAgbGV0IHBvdGVudGlhbEVycm9ySGludDtcbiAgICAgICAgY29uc3Qgc3BsaXQgPSBzb3VyY2Uuc3BsaXQoXCItLS1cIik7XG5cbiAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA+IDIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcIlRvbyBtYW55IGdyYXBoIHNlZ21lbnRzXCIpOyAvLyB0b2RvIC0gd3JpdGUgbWVhbmluZnVsIGVycm9yIG1lc3NhZ2VcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEVhY2ggKG5vbi1ibGFuaykgbGluZSBvZiB0aGUgZXF1YXRpb24gc291cmNlIGNvbnRhaW5zIGFuIGVxdWF0aW9uLFxuICAgICAgICAvLyAgdGhpcyB3aWxsIGFsd2F5cyBiZSB0aGUgbGFzdCBzZWdtZW50XG4gICAgICAgIGNvbnN0IGVxdWF0aW9ucyA9IHNwbGl0W3NwbGl0Lmxlbmd0aCAtIDFdXG4gICAgICAgICAgICAuc3BsaXQoL1xccj9cXG4vZylcbiAgICAgICAgICAgIC5maWx0ZXIoKGVxdWF0aW9uKSA9PiBlcXVhdGlvbi50cmltKCkgIT09IFwiXCIpXG4gICAgICAgICAgICAubWFwKEdyYXBoLnBhcnNlRXF1YXRpb24pXG4gICAgICAgICAgICAubWFwKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LmhpbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcG90ZW50aWFsRXJyb3JIaW50ID0gcmVzdWx0LmhpbnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQuZGF0YTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIC8vIElmIHRoZXJlIGlzIG1vcmUgdGhhbiBvbmUgc2VnbWVudCB0aGVuIHRoZSBmaXJzdCBvbmUgd2lsbCBjb250YWluIHRoZSBzZXR0aW5nc1xuICAgICAgICBjb25zdCBzZXR0aW5ncyA9IHNwbGl0Lmxlbmd0aCA+IDEgPyBHcmFwaC5wYXJzZVNldHRpbmdzKHNwbGl0WzBdKSA6IHt9O1xuXG4gICAgICAgIHJldHVybiBuZXcgR3JhcGgoZXF1YXRpb25zLCBzZXR0aW5ncywgcG90ZW50aWFsRXJyb3JIaW50KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgaGFzaCgpOiBQcm9taXNlPEhhc2g+IHtcbiAgICAgICAgaWYgKHRoaXMuX2hhc2gpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9oYXNoO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgaGFzaCBub3QgaW4gY2FjaGUgdGhlbiBjYWxjdWxhdGUgaXRcbiAgICAgICAgdGhpcy5faGFzaCA9IGF3YWl0IGNhbGN1bGF0ZUhhc2godGhpcyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9oYXNoO1xuICAgIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiByZW5kZXJFcnJvcihlcnI6IHN0cmluZywgZWw6IEhUTUxFbGVtZW50LCBleHRyYT86IEhUTUxTcGFuRWxlbWVudCkge1xuICAgIGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXG4gICAgY29uc3QgbWVzc2FnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHJvbmdcIik7XG4gICAgbWVzc2FnZS5pbm5lclRleHQgPSBcIkRlc21vcyBHcmFwaCBFcnJvcjogXCI7XG4gICAgd3JhcHBlci5hcHBlbmRDaGlsZChtZXNzYWdlKTtcblxuICAgIGNvbnN0IGN0eCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgIGN0eC5pbm5lclRleHQgPSBlcnI7XG4gICAgd3JhcHBlci5hcHBlbmRDaGlsZChjdHgpO1xuXG4gICAgaWYgKGV4dHJhKSB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2VFeHRyYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHJvbmdcIik7XG4gICAgICAgIG1lc3NhZ2VFeHRyYS5pbm5lckhUTUwgPSBcIjxicj5Ob3RlOiBcIjtcbiAgICAgICAgd3JhcHBlci5hcHBlbmRDaGlsZChtZXNzYWdlRXh0cmEpO1xuICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKGV4dHJhKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGNvbnRhaW5lci5zdHlsZS5wYWRkaW5nID0gXCIyMHB4XCI7XG4gICAgY29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwiI2Y0NDMzNlwiO1xuICAgIGNvbnRhaW5lci5zdHlsZS5jb2xvciA9IFwid2hpdGVcIjtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQod3JhcHBlcik7XG5cbiAgICBlbC5lbXB0eSgpO1xuICAgIGVsLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG59XG4iLCJpbXBvcnQgRGVzbW9zIGZyb20gXCIuL21haW5cIjtcclxuaW1wb3J0IHsgUGx1Z2luU2V0dGluZ1RhYiwgQXBwLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5leHBvcnQgZW51bSBDYWNoZUxvY2F0aW9uIHtcclxuICAgIE1lbW9yeSA9IFwiTWVtb3J5XCIsXHJcbiAgICBGaWxlc3lzdGVtID0gXCJGaWxlc3lzdGVtXCIsXHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU2V0dGluZ3Mge1xyXG4gICAgLyoqIFRoZSBwcm9ncmFtIHZlcnNpb24gdGhlc2Ugc2V0dGluZ3Mgd2VyZSBjcmVhdGVkIGluICovXHJcbiAgICB2ZXJzaW9uOiBzdHJpbmc7XHJcbiAgICAvLyAvKiogVGhlIGRlYm91bmNlIHRpbWVyIChpbiBtcykgKi9cclxuICAgIC8vIGRlYm91bmNlOiBudW1iZXI7XHJcbiAgICBjYWNoZTogQ2FjaGVTZXR0aW5ncztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYWNoZVNldHRpbmdzIHtcclxuICAgIGVuYWJsZWQ6IGJvb2xlYW47XHJcbiAgICBsb2NhdGlvbjogQ2FjaGVMb2NhdGlvbjtcclxuICAgIGRpcmVjdG9yeT86IHN0cmluZztcclxufVxyXG5cclxuY29uc3QgREVGQVVMVF9TRVRUSU5HU19TVEFUSUM6IE9taXQ8U2V0dGluZ3MsIFwidmVyc2lvblwiPiA9IHtcclxuICAgIC8vIGRlYm91bmNlOiA1MDAsXHJcbiAgICBjYWNoZToge1xyXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgbG9jYXRpb246IENhY2hlTG9jYXRpb24uTWVtb3J5LFxyXG4gICAgfSxcclxufTtcclxuXHJcbi8qKiBHZXQgdGhlIGRlZmF1bHQgc2V0dGluZ3MgZm9yIHRoZSBnaXZlbiBwbHVnaW4uIFRoaXMgc2ltcGx5IHVzZXMgYERFRkFVTFRfU0VUVElOR1NfU1RBVElDYCBhbmQgcGF0Y2hlcyB0aGUgdmVyc2lvbiBmcm9tIHRoZSBtYW5pZmVzdC4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIERFRkFVTFRfU0VUVElOR1MocGx1Z2luOiBEZXNtb3MpOiBTZXR0aW5ncyB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHZlcnNpb246IHBsdWdpbi5tYW5pZmVzdC52ZXJzaW9uLFxyXG4gICAgICAgIC4uLkRFRkFVTFRfU0VUVElOR1NfU1RBVElDLFxyXG4gICAgfTtcclxufVxyXG5cclxuLyoqIEF0dGVtcHQgdG8gbWlncmF0ZSB0aGUgZ2l2ZW4gc2V0dGluZ3Mgb2JqZWN0IHRvIHRoZSBjdXJyZW50IHN0cnVjdHVyZSAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbWlncmF0ZVNldHRpbmdzKHBsdWdpbjogRGVzbW9zLCBzZXR0aW5nczogb2JqZWN0KTogU2V0dGluZ3Mge1xyXG4gICAgLy8gdG9kbyAodGhlcmUgaXMgY3VycmVudGx5IG9ubHkgb25lIHZlcnNpb24gb2YgdGhlIHNldHRpbmdzIGludGVyZmFjZSlcclxuICAgIHJldHVybiBzZXR0aW5ncyBhcyBTZXR0aW5ncztcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFNldHRpbmdzVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XHJcbiAgICBwbHVnaW46IERlc21vcztcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBEZXNtb3MpIHtcclxuICAgICAgICBzdXBlcihhcHAsIHBsdWdpbik7XHJcbiAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XHJcbiAgICB9XHJcblxyXG4gICAgZGlzcGxheSgpIHtcclxuICAgICAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG5cclxuICAgICAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG5cclxuICAgICAgICAvLyBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAvLyAgICAgLnNldE5hbWUoXCJEZWJvdW5jZSBUaW1lIChtcylcIilcclxuICAgICAgICAvLyAgICAgLnNldERlc2MoXHJcbiAgICAgICAgLy8gICAgICAgICBcIkhvdyBsb25nIHRvIHdhaXQgYWZ0ZXIgYSBrZXlwcmVzcyB0byByZW5kZXIgdGhlIGdyYXBoIChzZXQgdG8gMCB0byBkaXNhYmxlLCByZXF1aXJlcyByZXN0YXJ0IHRvIHRha2UgZWZmZWN0KVwiXHJcbiAgICAgICAgLy8gICAgIClcclxuICAgICAgICAvLyAgICAgLmFkZFRleHQoKHRleHQpID0+XHJcbiAgICAgICAgLy8gICAgICAgICB0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRlYm91bmNlLnRvU3RyaW5nKCkpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGNvbnN0IHZhbCA9IHBhcnNlSW50KHZhbHVlKTtcclxuICAgICAgICAvLyAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWJvdW5jZSA9XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIE51bWJlci5pc05hTih2YWwpIHx8IHZhbCA8IDAgPyBERUZBVUxUX1NFVFRJTkdTX1NUQVRJQy5kZWJvdW5jZSA6IHZhbDtcclxuICAgICAgICAvLyAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAvLyAgICAgICAgIH0pXHJcbiAgICAgICAgLy8gICAgICk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgICAgICAuc2V0TmFtZShcIkNhY2hlXCIpXHJcbiAgICAgICAgICAgIC5zZXREZXNjKFwiV2hldGhlciB0byBjYWNoZSB0aGUgcmVuZGVyZWQgZ3JhcGhzXCIpXHJcbiAgICAgICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICAgICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5lbmFibGVkKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5lbmFibGVkID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIFJlc2V0IHRoZSBkaXNwbGF5IHNvIHRoZSBuZXcgc3RhdGUgY2FuIHJlbmRlclxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLmNhY2hlLmVuYWJsZWQpIHtcclxuICAgICAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgICAgICAgICAuc2V0TmFtZShcIkNhY2hlIGxvY2F0aW9uXCIpXHJcbiAgICAgICAgICAgICAgICAuc2V0RGVzYyhcIlNldCB0aGUgbG9jYXRpb24gdG8gY2FjaGUgcmVuZGVyZWQgZ3JhcGhzIChub3RlIHRoYXQgbWVtb3J5IGNhY2hpbmcgaXMgbm90IHBlcnNpc3RlbnQpXCIpXHJcbiAgICAgICAgICAgICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxyXG4gICAgICAgICAgICAgICAgICAgIGRyb3Bkb3duXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRPcHRpb24oQ2FjaGVMb2NhdGlvbi5NZW1vcnksIFwiTWVtb3J5XCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRPcHRpb24oQ2FjaGVMb2NhdGlvbi5GaWxlc3lzdGVtLCBcIkZpbGVzeXN0ZW1cIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNhY2hlLmxvY2F0aW9uKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5sb2NhdGlvbiA9IHZhbHVlIGFzIENhY2hlTG9jYXRpb247XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBSZXNldCB0aGUgZGlzcGxheSBzbyB0aGUgbmV3IHN0YXRlIGNhbiByZW5kZXJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5sb2NhdGlvbiA9PT0gQ2FjaGVMb2NhdGlvbi5GaWxlc3lzdGVtKSB7XHJcbiAgICAgICAgICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAgICAgICAgICAgICAuc2V0TmFtZShcIkNhY2hlIERpcmVjdG9yeVwiKVxyXG4gICAgICAgICAgICAgICAgICAgIC5zZXREZXNjKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBgVGhlIGRpcmVjdG9yeSB0byBzYXZlIGNhY2hlZCBncmFwaHMgaW4sIHJlbGF0aXZlIHRvIHRoZSB2YXVsdCByb290ICh0ZWNobmljYWwgbm90ZTogdGhlIGdyYXBocyB3aWxsIGJlIHNhdmVkIGFzIFxcYGRlc21vcy1ncmFwaC08aGFzaD4ucG5nXFxgIHdoZXJlIHRoZSBuYW1lIGlzIGEgU0hBLTI1NiBoYXNoIG9mIHRoZSBncmFwaCBzb3VyY2UpLiBBbHNvIG5vdGUgdGhhdCBhIGxvdCBvZiBqdW5rIHdpbGwgYmUgc2F2ZWQgdG8gdGhpcyBmb2xkZXIsIHlvdSBoYXZlIGJlZW4gd2FybmVkLmBcclxuICAgICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICAgICAgLmFkZFRleHQoKHRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5kaXJlY3RvcnkgPz8gXCJcIikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYWNoZS5kaXJlY3RvcnkgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgRGVzbW9zIGZyb20gXCIuL21haW5cIjtcclxuaW1wb3J0IHsgdWNhc3QgfSBmcm9tIFwiLi91dGlsc1wiO1xyXG5pbXBvcnQgeyByZW5kZXJFcnJvciB9IGZyb20gXCIuL2Vycm9yXCI7XHJcbmltcG9ydCB7IENhY2hlTG9jYXRpb24gfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xyXG5pbXBvcnQgeyBub3JtYWxpemVQYXRoLCBOb3RpY2UgfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuaW1wb3J0IHsgR3JhcGgsIExpbmVTdHlsZSwgUG9pbnRTdHlsZSB9IGZyb20gXCIuL2dyYXBoXCI7XHJcblxyXG5pbnRlcmZhY2UgUmVuZGVyRGF0YSB7XHJcbiAgICBncmFwaDogR3JhcGg7XHJcbiAgICBlbDogSFRNTEVsZW1lbnQ7XHJcbiAgICBjYWNoZUZpbGU/OiBzdHJpbmc7XHJcbiAgICByZXNvbHZlOiAoKSA9PiB2b2lkO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgUmVuZGVyZXIge1xyXG4gICAgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IERlc21vcztcclxuICAgIC8qKiBUaGUgc2V0IG9mIGdyYXBocyB3ZSBhcmUgY3VycmVudGx5IHJlbmRlcmluZywgbWFwcGVkIGJ5IHRoZWlyIGhhc2ggKi9cclxuICAgIHByaXZhdGUgcmVuZGVyaW5nOiBNYXA8c3RyaW5nLCBSZW5kZXJEYXRhPiA9IG5ldyBNYXAoKTtcclxuICAgIHByaXZhdGUgYWN0aXZlOiBib29sZWFuO1xyXG5cclxuICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihwbHVnaW46IERlc21vcykge1xyXG4gICAgICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xyXG4gICAgICAgIHRoaXMuYWN0aXZlID0gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGFjdGl2YXRlKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5hY3RpdmUpIHtcclxuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIHRoaXMuaGFuZGxlci5iaW5kKHRoaXMpKTtcclxuICAgICAgICAgICAgdGhpcy5hY3RpdmUgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgZGVhY3RpdmF0ZSgpIHtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmUpIHtcclxuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIHRoaXMuaGFuZGxlci5iaW5kKHRoaXMpKTtcclxuICAgICAgICAgICAgdGhpcy5hY3RpdmUgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGFzeW5jIHJlbmRlcihncmFwaDogR3JhcGgsIGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIGNvbnN0IHBsdWdpbiA9IHRoaXMucGx1Z2luO1xyXG4gICAgICAgIGNvbnN0IHNldHRpbmdzID0gcGx1Z2luLnNldHRpbmdzO1xyXG5cclxuICAgICAgICBjb25zdCBlcXVhdGlvbnMgPSBncmFwaC5lcXVhdGlvbnM7XHJcbiAgICAgICAgY29uc3QgZ3JhcGhTZXR0aW5ncyA9IGdyYXBoLnNldHRpbmdzO1xyXG4gICAgICAgIGNvbnN0IGhhc2ggPSBhd2FpdCBncmFwaC5oYXNoKCk7XHJcblxyXG4gICAgICAgIGxldCBjYWNoZUZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgLy8gSWYgdGhpcyBncmFwaCBpcyBpbiB0aGUgY2FjaGUgdGhlbiBmZXRjaCBpdFxyXG4gICAgICAgIGlmIChzZXR0aW5ncy5jYWNoZS5lbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmIChzZXR0aW5ncy5jYWNoZS5sb2NhdGlvbiA9PT0gQ2FjaGVMb2NhdGlvbi5NZW1vcnkgJiYgaGFzaCBpbiBwbHVnaW4uZ3JhcGhDYWNoZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHBsdWdpbi5ncmFwaENhY2hlW2hhc2hdO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImltZ1wiKTtcclxuICAgICAgICAgICAgICAgIGltZy5zcmMgPSBkYXRhO1xyXG4gICAgICAgICAgICAgICAgZWwuYXBwZW5kQ2hpbGQoaW1nKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChzZXR0aW5ncy5jYWNoZS5sb2NhdGlvbiA9PT0gQ2FjaGVMb2NhdGlvbi5GaWxlc3lzdGVtICYmIHNldHRpbmdzLmNhY2hlLmRpcmVjdG9yeSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgYWRhcHRlciA9IHBsdWdpbi5hcHAudmF1bHQuYWRhcHRlcjtcclxuXHJcbiAgICAgICAgICAgICAgICBjYWNoZUZpbGUgPSBub3JtYWxpemVQYXRoKGAke3NldHRpbmdzLmNhY2hlLmRpcmVjdG9yeX0vZGVzbW9zLWdyYXBoLSR7aGFzaH0ucG5nYCk7XHJcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGlzIGdyYXBoIGlzIGluIHRoZSBjYWNoZVxyXG4gICAgICAgICAgICAgICAgaWYgKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKGNhY2hlRmlsZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW1nXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGltZy5zcmMgPSBhZGFwdGVyLmdldFJlc291cmNlUGF0aChjYWNoZUZpbGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGVsLmFwcGVuZENoaWxkKGltZyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBQYXJzZSBlcXVhdGlvbnMgaW50byBhIHNlcmllcyBvZiBEZXNtb3MgZXhwcmVzc2lvbnNcclxuICAgICAgICBjb25zdCBleHByZXNzaW9uczogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICBmb3IgKGNvbnN0IGVxdWF0aW9uIG9mIGVxdWF0aW9ucykge1xyXG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxyXG4gICAgICAgICAgICBjb25zdCBleHByZXNzaW9uOiBhbnkgPSB7fTtcclxuXHJcbiAgICAgICAgICAgIGlmIChlcXVhdGlvbi5yZXN0cmljdGlvbnMpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3RyaWN0aW9uID0gZXF1YXRpb24ucmVzdHJpY3Rpb25zXHJcbiAgICAgICAgICAgICAgICAgICAgLm1hcCgocmVzdHJpY3Rpb24pID0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGB7JHtyZXN0cmljdGlvbn19YFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXNjYXBlIGNoYXJzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZUFsbChcIntcIiwgU3RyaW5nLnJhd2BcXHtgKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2VBbGwoXCJ9XCIsIFN0cmluZy5yYXdgXFx9YClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlQWxsKFwiPD1cIiwgU3RyaW5nLnJhd2BcXGxlcSBgKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2VBbGwoXCI+PVwiLCBTdHJpbmcucmF3YFxcZ2VxIGApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZUFsbChcIjxcIiwgU3RyaW5nLnJhd2BcXGxlIGApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZUFsbChcIj5cIiwgU3RyaW5nLnJhd2BcXGdlIGApXHJcbiAgICAgICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAgICAgICAgIC5qb2luKFwiXCIpO1xyXG5cclxuICAgICAgICAgICAgICAgIGV4cHJlc3Npb24ubGF0ZXggPSBgJHtlcXVhdGlvbi5lcXVhdGlvbn0ke3Jlc3RyaWN0aW9ufWA7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uLmxhdGV4ID0gZXF1YXRpb24uZXF1YXRpb247XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChlcXVhdGlvbi5jb2xvcikge1xyXG4gICAgICAgICAgICAgICAgZXhwcmVzc2lvbi5jb2xvciA9IGVxdWF0aW9uLmNvbG9yO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoZXF1YXRpb24uc3R5bGUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChPYmplY3QudmFsdWVzKExpbmVTdHlsZSkuaW5jbHVkZXModWNhc3QoZXF1YXRpb24uc3R5bGUpKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb24ubGluZVN0eWxlID0gZXF1YXRpb24uc3R5bGU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKE9iamVjdC52YWx1ZXMoUG9pbnRTdHlsZSkuaW5jbHVkZXModWNhc3QoZXF1YXRpb24uc3R5bGUpKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb24ucG9pbnRTdHlsZSA9IGVxdWF0aW9uLnN0eWxlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBDYWxsaW5nIEpTT04uc3RyaW5naWZ5IHR3aWNlIGFsbG93cyB1cyB0byBlc2NhcGUgdGhlIHN0cmluZ3MgYXMgd2VsbCxcclxuICAgICAgICAgICAgLy8gIG1lYW5pbmcgd2UgY2FuIGVtYmVkIGl0IGRpcmVjdGx5IGludG8gdGhlIGNhbGN1bGF0b3IgdG8gdW5kbyB0aGUgZmlyc3Qgc3RyaW5naWZpY2F0aW9uIHdpdGhvdXQgcGFyc2luZ1xyXG4gICAgICAgICAgICBleHByZXNzaW9ucy5wdXNoKGBjYWxjdWxhdG9yLnNldEV4cHJlc3Npb24oSlNPTi5wYXJzZSgke0pTT04uc3RyaW5naWZ5KEpTT04uc3RyaW5naWZ5KGV4cHJlc3Npb24pKX0pKTtgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEJlY2F1c2Ugb2YgdGhlIGVsZWN0cm9uIHNhbmRib3hpbmcgd2UgaGF2ZSB0byBkbyB0aGlzIGluc2lkZSBhbiBpZnJhbWUgKGFuZCByZWdhcmRsZXNzIHRoaXMgaXMgc2FmZXIpLFxyXG4gICAgICAgIC8vICAgb3RoZXJ3aXNlIHdlIGNhbid0IGluY2x1ZGUgdGhlIGRlc21vcyBBUEkgKGFsdGhvdWdoIGl0IHdvdWxkIGJlIG5pY2UgaWYgdGhleSBoYWQgYSBSRVNUIEFQSSBvZiBzb21lIHNvcnQpXHJcbiAgICAgICAgLy8gSW50ZXJlc3RpbmdseSBlbm91Z2gsIHRoaXMgc2NyaXB0IGZ1bmN0aW9ucyBwZXJmZWN0bHkgZmluZSBmdWxseSBvZmZsaW5lIC0gc28gd2UgY291bGQgaW5jbHVkZSBhIHZlbmRvcmVkIGNvcHkgaWYgbmVlZCBiZVxyXG4gICAgICAgIC8vICAgKHRoZSBzY3JpcHQgZ2V0cyBjYWNoZWQgYnkgZWxlY3Ryb24gdGhlIGZpcnN0IHRpbWUgaXQncyB1c2VkIHNvIHRoaXMgaXNuJ3QgYSBwYXJ0aWN1bGFybHkgaGlnaCBwcmlvcml0eSlcclxuICAgICAgICBjb25zdCBodG1sSGVhZCA9IGA8c2NyaXB0IHNyYz1cImh0dHBzOi8vd3d3LmRlc21vcy5jb20vYXBpL3YxLjYvY2FsY3VsYXRvci5qcz9hcGlLZXk9ZGNiMzE3MDliNDUyYjFjZjlkYzI2OTcyYWRkMGZkYTZcIj48L3NjcmlwdD5gO1xyXG4gICAgICAgIGNvbnN0IGh0bWxCb2R5ID0gYFxyXG4gICAgICAgICAgICA8ZGl2IGlkPVwiY2FsY3VsYXRvci0ke2hhc2h9XCIgc3R5bGU9XCJ3aWR0aDogJHtncmFwaFNldHRpbmdzLndpZHRofXB4OyBoZWlnaHQ6ICR7XHJcbiAgICAgICAgICAgIGdyYXBoU2V0dGluZ3MuaGVpZ2h0XHJcbiAgICAgICAgfXB4O1wiPjwvZGl2PlxyXG4gICAgICAgICAgICA8c2NyaXB0PlxyXG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcclxuICAgICAgICAgICAgICAgICAgICBzZXR0aW5nc01lbnU6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb25zOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBsb2NrVmlld1BvcnQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgem9vbUJ1dHRvbnM6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIHRyYWNlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBzaG93R3JpZDogJHtncmFwaFNldHRpbmdzLmdyaWR9LFxyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBjYWxjdWxhdG9yID0gRGVzbW9zLkdyYXBoaW5nQ2FsY3VsYXRvcihkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImNhbGN1bGF0b3ItJHtoYXNofVwiKSwgb3B0aW9ucyk7XHJcbiAgICAgICAgICAgICAgICBjYWxjdWxhdG9yLnNldE1hdGhCb3VuZHMoe1xyXG4gICAgICAgICAgICAgICAgICAgIGxlZnQ6ICR7Z3JhcGhTZXR0aW5ncy5sZWZ0fSxcclxuICAgICAgICAgICAgICAgICAgICByaWdodDogJHtncmFwaFNldHRpbmdzLnJpZ2h0fSxcclxuICAgICAgICAgICAgICAgICAgICB0b3A6ICR7Z3JhcGhTZXR0aW5ncy50b3B9LFxyXG4gICAgICAgICAgICAgICAgICAgIGJvdHRvbTogJHtncmFwaFNldHRpbmdzLmJvdHRvbX0sXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAke2V4cHJlc3Npb25zLmpvaW4oXCJcXG5cIil9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gRGVzbW9zIHJldHVybnMgYW4gZXJyb3IgaWYgd2UgdHJ5IHRvIG9ic2VydmUgdGhlIGV4cHJlc3Npb25zIHdpdGhvdXQgYW55IGRlZmluZWRcclxuICAgICAgICAgICAgICAgIGlmICgke2V4cHJlc3Npb25zLmxlbmd0aCA+IDB9KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsY3VsYXRvci5vYnNlcnZlKFwiZXhwcmVzc2lvbkFuYWx5c2lzXCIsICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBpZCBpbiBjYWxjdWxhdG9yLmV4cHJlc3Npb25BbmFseXNpcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYW5hbHlzaXMgPSBjYWxjdWxhdG9yLmV4cHJlc3Npb25BbmFseXNpc1tpZF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYW5hbHlzaXMuaXNFcnJvcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudC5wb3N0TWVzc2FnZSh7IHQ6IFwiZGVzbW9zLWdyYXBoXCIsIGQ6IFwiZXJyb3JcIiwgbzogXCIke1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3JpZ2luXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVwiLCBkYXRhOiBhbmFseXNpcy5lcnJvck1lc3NhZ2UsIGhhc2g6IFwiJHtoYXNofVwiIH0sIFwiJHt3aW5kb3cub3JpZ2lufVwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNhbGN1bGF0b3IuYXN5bmNTY3JlZW5zaG90KHsgc2hvd0xhYmVsczogdHJ1ZSwgZm9ybWF0OiBcInBuZ1wiIH0sIChkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5pbm5lckhUTUwgPSBcIlwiO1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudC5wb3N0TWVzc2FnZSh7IHQ6IFwiZGVzbW9zLWdyYXBoXCIsIGQ6IFwicmVuZGVyXCIsIG86IFwiJHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9yaWdpblxyXG4gICAgICAgICAgICAgICAgICAgIH1cIiwgZGF0YSwgaGFzaDogXCIke2hhc2h9XCIgfSwgXCIke3dpbmRvdy5vcmlnaW59XCIpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIDwvc2NyaXB0PlxyXG4gICAgICAgIGA7XHJcbiAgICAgICAgY29uc3QgaHRtbFNyYyA9IGA8aHRtbD48aGVhZD4ke2h0bWxIZWFkfTwvaGVhZD48Ym9keT4ke2h0bWxCb2R5fTwvYm9keT5gO1xyXG5cclxuICAgICAgICBjb25zdCBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaWZyYW1lXCIpO1xyXG4gICAgICAgIGlmcmFtZS5zYW5kYm94LmFkZChcImFsbG93LXNjcmlwdHNcIik7IC8vIGVuYWJsZSBzYW5kYm94IG1vZGUgLSB0aGlzIHByZXZlbnRzIGFueSB4c3MgZXhwbG9pdHMgZnJvbSBhbiB1bnRydXN0ZWQgc291cmNlIGluIHRoZSBmcmFtZSAoYW5kIHByZXZlbnRzIGl0IGZyb20gYWNjZXNzaW5nIHRoZSBwYXJlbnQpXHJcbiAgICAgICAgaWZyYW1lLndpZHRoID0gZ3JhcGhTZXR0aW5ncy53aWR0aC50b1N0cmluZygpO1xyXG4gICAgICAgIGlmcmFtZS5oZWlnaHQgPSBncmFwaFNldHRpbmdzLmhlaWdodC50b1N0cmluZygpO1xyXG4gICAgICAgIGlmcmFtZS5zdHlsZS5ib3JkZXIgPSBcIm5vbmVcIjtcclxuICAgICAgICBpZnJhbWUuc2Nyb2xsaW5nID0gXCJub1wiOyAvLyBmaXhtZSB1c2UgYSBub24tZGVwcmVjaWF0ZWQgZnVuY3Rpb25cclxuICAgICAgICBpZnJhbWUuc3JjZG9jID0gaHRtbFNyYztcclxuICAgICAgICAvLyBpZnJhbWUuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiOyAvLyBmaXhtZSBoaWRpbmcgdGhlIGlmcmFtZSBicmVha3MgdGhlIHBvc2l0aW9uaW5nXHJcblxyXG4gICAgICAgIGVsLmFwcGVuZENoaWxkKGlmcmFtZSk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gdGhpcy5yZW5kZXJpbmcuc2V0KGhhc2gsIHsgZ3JhcGgsIGVsLCByZXNvbHZlLCBjYWNoZUZpbGUgfSkpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlcihcclxuICAgICAgICBtZXNzYWdlOiBNZXNzYWdlRXZlbnQ8eyB0OiBzdHJpbmc7IGQ6IHN0cmluZzsgbzogc3RyaW5nOyBkYXRhOiBzdHJpbmc7IGhhc2g6IHN0cmluZyB9PlxyXG4gICAgKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgaWYgKG1lc3NhZ2UuZGF0YS5vID09PSB3aW5kb3cub3JpZ2luICYmIG1lc3NhZ2UuZGF0YS50ID09PSBcImRlc21vcy1ncmFwaFwiKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5yZW5kZXJpbmcuZ2V0KG1lc3NhZ2UuZGF0YS5oYXNoKTtcclxuICAgICAgICAgICAgaWYgKHN0YXRlKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB7IGdyYXBoLCBlbCwgcmVzb2x2ZSwgY2FjaGVGaWxlIH0gPSBzdGF0ZTtcclxuXHJcbiAgICAgICAgICAgICAgICBlbC5lbXB0eSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChtZXNzYWdlLmRhdGEuZCA9PT0gXCJlcnJvclwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdyYXBoLnBvdGVudGlhbEVycm9ySGludCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZW5kZXJFcnJvcihtZXNzYWdlLmRhdGEuZGF0YSwgZWwsIGdyYXBoLnBvdGVudGlhbEVycm9ySGludC52aWV3KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpOyAvLyBsZXQgY2FsbGVyIGtub3cgd2UgYXJlIGRvbmUgcmVuZGVyaW5nXHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1lc3NhZ2UuZGF0YS5kID09PSBcInJlbmRlclwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBkYXRhIH0gPSBtZXNzYWdlLmRhdGE7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbWdcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgaW1nLnNyYyA9IGRhdGE7XHJcbiAgICAgICAgICAgICAgICAgICAgZWwuYXBwZW5kQ2hpbGQoaW1nKTtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7IC8vIGxldCBjYWxsZXIga25vdyB3ZSBhcmUgZG9uZSByZW5kZXJpbmdcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGx1Z2luID0gdGhpcy5wbHVnaW47XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3MgPSBwbHVnaW4uc2V0dGluZ3M7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzaCA9IGF3YWl0IGdyYXBoLmhhc2goKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2V0dGluZ3MuY2FjaGUuZW5hYmxlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2V0dGluZ3MuY2FjaGUubG9jYXRpb24gPT09IENhY2hlTG9jYXRpb24uTWVtb3J5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbHVnaW4uZ3JhcGhDYWNoZVtoYXNoXSA9IGRhdGE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc2V0dGluZ3MuY2FjaGUubG9jYXRpb24gPT09IENhY2hlTG9jYXRpb24uRmlsZXN5c3RlbSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYWRhcHRlciA9IHBsdWdpbi5hcHAudmF1bHQuYWRhcHRlcjtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FjaGVGaWxlICYmIHNldHRpbmdzLmNhY2hlLmRpcmVjdG9yeSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhd2FpdCBhZGFwdGVyLmV4aXN0cyhzZXR0aW5ncy5jYWNoZS5kaXJlY3RvcnkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IEJ1ZmZlci5mcm9tKGRhdGEucmVwbGFjZSgvXmRhdGE6aW1hZ2VcXC9wbmc7YmFzZTY0LC8sIFwiXCIpLCBcImJhc2U2NFwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgYWRhcHRlci53cml0ZUJpbmFyeShjYWNoZUZpbGUsIGJ1ZmZlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVudXNlZC1leHByZXNzaW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgZGVzbW9zLWdyYXBoOiB0YXJnZXQgY2FjaGUgZGlyZWN0b3J5ICcke3NldHRpbmdzLmNhY2hlLmRpcmVjdG9yeX0nIGRvZXMgbm90IGV4aXN0LCBza2lwcGluZyBjYWNoZWAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxMDAwMFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVudXNlZC1leHByZXNzaW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYGRlc21vcy1ncmFwaDogZmlsZXN5c3RlbSBjYWNoaW5nIGVuYWJsZWQgYnV0IG5vIGNhY2hlIGRpcmVjdG9yeSBzZXQsIHNraXBwaW5nIGNhY2hlYCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTAwMDBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyaW5nLmRlbGV0ZShtZXNzYWdlLmRhdGEuaGFzaCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBkbyBub3RoaW5nIGlmIGdyYXBoIGlzIG5vdCBpbiByZW5kZXIgbGlzdCAodGhpcyBzaG91bGQgbm90IGhhcHBlbilcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcclxuICAgICAgICAgICAgICAgICAgICBgR290IGdyYXBoIG5vdCBpbiByZW5kZXIgbGlzdCwgdGhpcyBpcyBwcm9iYWJseSBhIGJ1ZyAtICR7SlNPTi5zdHJpbmdpZnkodGhpcy5yZW5kZXJpbmcpfWBcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuIiwiaW1wb3J0IHsgR3JhcGggfSBmcm9tIFwiLi9ncmFwaFwiO1xyXG5pbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuaW1wb3J0IHsgUmVuZGVyZXIgfSBmcm9tIFwiLi9yZW5kZXJlclwiO1xyXG5pbXBvcnQgeyByZW5kZXJFcnJvciB9IGZyb20gXCIuL2Vycm9yXCI7XHJcbmltcG9ydCB7IERFRkFVTFRfU0VUVElOR1MsIG1pZ3JhdGVTZXR0aW5ncywgU2V0dGluZ3MsIFNldHRpbmdzVGFiIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERlc21vcyBleHRlbmRzIFBsdWdpbiB7XHJcbiAgICAvLyBXZSBsb2FkIHRoZSBzZXR0aW5ncyBiZWZvcmUgYWNjZXNzaW5nIHRoZW0sIHNvIHdlIGNhbiBlbnN1cmUgdGhpcyBvYmplY3QgYWx3YXlzIGV4aXN0c1xyXG4gICAgc2V0dGluZ3MhOiBTZXR0aW5ncztcclxuXHJcbiAgICAvLyBXZSBjcmVhdGUgdGhlIHJlbmRlcmVyIGJlZm9yZSByZWdpc3RlcmluZyB0aGUgY29kZWJsb2NrLCBzbyB3ZSBjYW4gZW5zdXJlIHRoaXMgb2JqZWN0IGFsd2F5cyBleGlzdHNcclxuICAgIHJlbmRlcmVyITogUmVuZGVyZXI7XHJcblxyXG4gICAgLyoqIEhlbHBlciBmb3IgaW4tbWVtb3J5IGdyYXBoIGNhY2hpbmcgKi9cclxuICAgIGdyYXBoQ2FjaGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcclxuXHJcbiAgICBhc3luYyBvbmxvYWQoKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcclxuICAgICAgICB0aGlzLnJlbmRlcmVyID0gbmV3IFJlbmRlcmVyKHRoaXMpO1xyXG4gICAgICAgIHRoaXMucmVuZGVyZXIuYWN0aXZhdGUoKTtcclxuXHJcbiAgICAgICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBTZXR0aW5nc1RhYih0aGlzLmFwcCwgdGhpcykpO1xyXG5cclxuICAgICAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXCJkZXNtb3MtZ3JhcGhcIiwgYXN5bmMgKHNvdXJjZSwgZWwpID0+IHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGdyYXBoID0gR3JhcGgucGFyc2Uoc291cmNlKTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucmVuZGVyZXIucmVuZGVyKGdyYXBoLCBlbCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVuZGVyRXJyb3IoZXJyLm1lc3NhZ2UsIGVsKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGVyciA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlbmRlckVycm9yKGVyciwgZWwpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZW5kZXJFcnJvcihcIlVuZXhwZWN0ZWQgZXJyb3IgLSBzZWUgY29uc29sZSBmb3IgZGVidWcgbG9nXCIsIGVsKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyB1bmxvYWQoKSB7XHJcbiAgICAgICAgdGhpcy5yZW5kZXJlci5kZWFjdGl2YXRlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xyXG4gICAgICAgIGxldCBzZXR0aW5ncyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKTtcclxuXHJcbiAgICAgICAgaWYgKCFzZXR0aW5ncykge1xyXG4gICAgICAgICAgICBzZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1ModGhpcyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoc2V0dGluZ3MudmVyc2lvbiAhPT0gdGhpcy5tYW5pZmVzdC52ZXJzaW9uKSB7XHJcbiAgICAgICAgICAgIHNldHRpbmdzID0gbWlncmF0ZVNldHRpbmdzKHRoaXMsIHNldHRpbmdzKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuICAgIH1cclxufVxyXG4iXSwibmFtZXMiOlsiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJu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
