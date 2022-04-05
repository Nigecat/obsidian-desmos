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
        this.settings = Object.assign(Object.assign({}, settings), DEFAULT_GRAPH_SETTINGS);
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
                    throw new SyntaxError(`Duplicate color identifiers detected: ${equation.color}, ${segment}`);
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
                throw new SyntaxError("Too many segments"); // todo
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
                        .replaceAll("<=", String.raw `\leq`)
                        .replaceAll(">=", String.raw `\geq`)
                        .replaceAll("<", String.raw `\le`)
                        .replaceAll(">", String.raw `\ge`))
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
                //  meaning we can embed it directly into the calculator to undo the first parse without parsing
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy91dGlscy50cyIsInNyYy9oYXNoLnRzIiwic3JjL2dyYXBoL2ludGVyZmFjZS50cyIsInNyYy9ncmFwaC9wYXJzZXIudHMiLCJzcmMvZXJyb3IudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6bnVsbCwibmFtZXMiOlsiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJub3JtYWxpemVQYXRoIiwiTm90aWNlIiwiUGx1Z2luIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXVEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVB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
