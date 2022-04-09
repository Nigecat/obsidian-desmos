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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateSettings(_plugin, settings) {
    // todo (there is currently only one version of the settings interface)
    // Added in v0.x.x // todo set correct version
    if (settings.live === undefined) {
        settings.live = DEFAULT_SETTINGS_STATIC.live;
    }
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
            .setDesc("Whether live mode is enabled, this will allow you to directly interact with the rendered graph to modify the positioning and scale. Note that this can be enabled on a per-graph basis by using the `live` flag.")
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.live).onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.live = value;
            yield this.plugin.saveSettings();
            // Clear graph cache so the user doesn't need to restart Obsidian for this setting to take effect
            this.plugin.graphCache = {};
        })));
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
    lock: false,
    live: false,
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
        this._settings = Object.assign(Object.assign({}, DEFAULT_GRAPH_SETTINGS), settings);
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
    get settings() {
        return this._settings;
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
    update(updateCtx, data) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { ctx, plugin, target } = updateCtx;
            console.log("Performing update with data:");
            console.log(data); // todo float values should be truncated
            const info = ctx.getSectionInfo(target);
            const editor = (_a = plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView)) === null || _a === void 0 ? void 0 : _a.editor;
            if (info && editor) {
                // Extract the content of the codeblock
                const content = info.text.split(/\r?\n/g).slice(info.lineStart, info.lineEnd).join("\n");
                // The changes made to the document,
                //   these will be applied in parallel so all line numbers and character offsets should be relative to the original content
                const changes = [];
                // If there is no separator, add one
                if (!content.includes("---")) {
                    changes.push({
                        text: `---\n`,
                        from: { line: info.lineStart + 1, ch: 0 },
                        to: { line: info.lineStart + 1, ch: 0 },
                    });
                }
                // Attempt to insert new fields in a way which does not interfere with the existing format set by the user
                for (const [key, value] of Object.entries(data)) {
                    // If this key already exists in the source, then we can just change its value
                    const existing = new RegExp(String.raw `${key}\s*=\s*[a-zA-Z0-9#]+\s*[\n;]`, "g").exec(content);
                    // const existing = content.match(new RegExp(String.raw`${key}\s*=\s*[a-zA-Z0-9#]+\s*[\n;]`, "g"));
                    // Duplicate keys are not allowed so there should always be zero or one matches
                    if (existing && existing.length > 0) {
                        const existingValue = /=\s*[a-zA-Z0-9#]+/g.exec(existing[0]);
                        if (existingValue && existingValue.length > 0) {
                            // const existingValueLength = existingValue[0].substring(1).trim().length;
                            // const valueOffset = existing[0].length - existingValueLength - extra;
                            // const globalOffset = existing.index;
                            // const offset = globalOffset + valueOffset;
                            // const length = existingValueLength;
                            const existingValueLength = existingValue[0].substring(1).trim().length;
                            const extra = existing[0].length - (existingValue.index + existingValue[0].length);
                            const valueOffset = existing[0].length - existingValueLength - extra;
                            const globalOffset = existing.index;
                            const offset = globalOffset + valueOffset;
                            console.log(offset, existingValueLength);
                        }
                    }
                }
                // Apply changes in a single transaction so ctrl+z and the like function as expected
                editor.transaction({ changes });
                // Update our internal object
                this._settings = Object.assign(Object.assign({}, this.settings), data);
            }
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
            if (key in graphSettings) {
                throw new SyntaxError(`Duplicate key '${key}' not allowed`);
            }
            switch (key) {
                // Boolean fields
                case "lock":
                case "live":
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
    render(graph, el, update) {
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

                if (${update !== undefined}) {
                    // Live mode does not need to resolve to a screenshot
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
                    calculator.asyncScreenshot({ showLabels: true, format: "svg" }, (data) => {
                        document.body.innerHTML = "";
                        parent.postMessage({ t: "desmos-graph", d: "render", o: "${window.origin}", data, hash: "${hash}" }, "${window.origin}");
                    });   
                }
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
            return new Promise((resolve) => this.rendering.set(hash, { graph, el, resolve, cacheFile, update }));
        });
    }
    handler(message) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (message.data.o === window.origin && message.data.t === "desmos-graph") {
                const state = this.rendering.get(message.data.hash);
                if (state) {
                    const { update, graph, el, resolve, cacheFile } = state;
                    if (message.data.d !== "update") {
                        el.empty();
                    }
                    if (message.data.d === "error") {
                        renderError(message.data.data, el, (_a = graph.potentialErrorHint) === null || _a === void 0 ? void 0 : _a.view);
                        resolve(); // let caller know we are done rendering
                    }
                    else if (message.data.d === "update" && update !== undefined) {
                        // Handle live mode update
                        const data = JSON.parse(message.data.data);
                        update(data);
                        return;
                        // resolve
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
                    if (message.data.d !== "update") {
                        this.rendering.delete(message.data.hash);
                    }
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
            this.registerMarkdownCodeBlockProcessor("desmos-graph", (source, el, ctx) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const graph = Graph.parse(source);
                    // Determine whether live mode should be enabled for this graph
                    const live = graph.settings.lock ? false : graph.settings.live || this.settings.live;
                    // If live mode is enabled, generate an update function using the specific context of this markdown codeblock
                    const update = live
                        ? obsidian.debounce((data) => graph.update({ target: el, ctx, plugin: this }, data), 500)
                        : undefined;
                    yield this.renderer.render(graph, el, update);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy91dGlscy50cyIsInNyYy9lcnJvci50cyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy9ncmFwaC9pbnRlcmZhY2UudHMiLCJzcmMvZ3JhcGgvcGFyc2VyLnRzIiwic3JjL3JlbmRlcmVyLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOm51bGwsIm5hbWVzIjpbIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwiTWFya2Rvd25WaWV3Iiwibm9ybWFsaXplUGF0aCIsIk5vdGljZSIsIlBsdWdpbiIsImRlYm91bmNlIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXVEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDdEcsUUFBUSxTQUFTLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUU7QUFDdEgsUUFBUSxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsVUFBVSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDOUUsS0FBSyxDQUFDLENBQUM7QUFDUDs7QUMzRUE7U0FDc0IsYUFBYSxDQUFJLEdBQU07O1FBQ3pDLE1BQU0sSUFBSSxHQUFHLElBQUksV0FBVyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMzRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMzRCxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7O1FBRS9DLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRXRFLE9B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
