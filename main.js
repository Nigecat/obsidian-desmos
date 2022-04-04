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

function calculateHash(val) {
    return __awaiter(this, void 0, void 0, function* () {
        // todo
        return "";
    });
}

var LineStyle;
(function (LineStyle) {
    LineStyle["SOLID"] = "SOLID";
    LineStyle["DASHED"] = "DASHED";
    LineStyle["DOTTED"] = "DOTTED";
})(LineStyle || (LineStyle = {}));
var PointStyle;
(function (PointStyle) {
    PointStyle["POINT"] = "POINT";
    PointStyle["OPEN"] = "OPEN";
    PointStyle["CROSS"] = "CROSS";
})(PointStyle || (PointStyle = {}));
var ColorConstant;
(function (ColorConstant) {
    ColorConstant["RED"] = "#ff0000";
    ColorConstant["GREEN"] = "#00ff00";
    ColorConstant["BLUE"] = "#0000ff";
    ColorConstant["YELLOW"] = "#ffff00";
    ColorConstant["MAGENTA"] = "#ff00ff";
    ColorConstant["CYAN"] = "#00ffff";
    ColorConstant["PURPLE"] = "#cc8899";
    ColorConstant["ORANGE"] = "#ffa500";
    ColorConstant["BLACK"] = "#000000";
    ColorConstant["WHITE"] = "#ffffff";
})(ColorConstant || (ColorConstant = {}));

const DEFAULT_GRAPH_SETTINGS = {
    width: 600,
    height: 400,
    left: -10,
    right: 10,
    bottom: -7,
    top: 7,
    grid: true,
};
class Graph {
    constructor(equations, settings, potentialErrorHints) {
        this.equations = equations;
        this.potentialErrorHints = potentialErrorHints;
        // todo apply defaults
        this.settings = settings;
    }
    static parseEquation(equation) {
        // todo
        return { data: null };
    }
    static parseSettings(settings) {
        const graphSettings = {};
        // Settings may be separated by either a newline or semicolon
        settings
            .split(/[;\n]/g)
            .filter((setting) => setting.trim() !== "")
            // Extract key-value pairs by splitting on the `=` in each property
            .map((setting) => setting.split("="))
            .forEach((setting) => {
            if (setting.length > 2) {
                throw new SyntaxError("Too many segments"); // todo
            }
            const key = setting[0].trim();
            const value = setting.length > 1 ? settings[1].trim() : undefined;
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
        const split = source.split("---");
        const potentialErrorHints = [];
        if (split.length > 2) {
            throw new SyntaxError("Too many graph segments"); // todo
        }
        // Each (non-blank) line of the equation source contains an equation,
        //  this will always be the last segment
        const equations = split[split.length - 1]
            .split(/\r?\n/g)
            .filter((equation) => equation.trim() !== "")
            .map(Graph.parseEquation)
            .map((result) => {
            if (result.hint) {
                potentialErrorHints.push(result.hint);
            }
            return result.data;
        });
        // If there is more than one segment then the first one will contain the settings
        const settings = split.length > 1 ? Graph.parseSettings(split[0]) : {};
        return new Graph(equations, settings, potentialErrorHints);
    }
    hash() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._hash) {
                return this._hash;
            }
            // If hash not in cache then calculate it
            this._hash = yield calculateHash();
            return this._hash;
        });
    }
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
            const expressions = equations.map((equation) => {
                var _a;
                return `calculator.setExpression({
                    latex: \`${equation.equation.replace(/\\/g, "\\\\")}${
                // interpolation is safe as we ensured the string did not contain any quotes (`) in the parser
                ((_a = equation.restriction) !== null && _a !== void 0 ? _a : "")
                    .replaceAll("{", "\\\\{")
                    .replaceAll("}", "\\\\}")
                    .replaceAll("<=", "\\\\leq ")
                    .replaceAll(">=", "\\\\geq ")
                    .replaceAll("<", "\\\\le ")
                    .replaceAll(">", "\\\\ge ")}\`,

                    ${(() => {
                    if (equation.style) {
                        if (equation.style in Object.values(LineStyle)) {
                            return `lineStyle: Desmos.Styles.${equation.style}`;
                        }
                        else if (equation.style in Object.values(PointStyle)) {
                            return `pointStyle: Desmos.Styles.${equation.style}`;
                        }
                        else ;
                    }
                    return "";
                })()}

                    ${equation.color ? `color: \`${equation.color}\`,` : ""}
                });`;
            });
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
                        // todo render potentialErrorHints
                        if (graph.potentialErrorHints) {
                            console.warn(graph.potentialErrorHints);
                            // renderError(message.data.data, el, graphSettings.potentialErrorHints);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9oYXNoLnRzIiwic3JjL2dyYXBoL2ludGVyZmFjZS50cyIsInNyYy9ncmFwaC9wYXJzZXIudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvZXJyb3IudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6bnVsbCwibmFtZXMiOlsiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJub3JtYWxpemVQYXRoIiwiTm90aWNlIiwiUGx1Z2luIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXVEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVB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
