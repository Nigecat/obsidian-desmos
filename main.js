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

class Dsl {
    constructor(equations = [], width = 600, height = 400, boundry_left = -10, boundry_right = 10, boundry_bottom = -7, boundry_top = 7) {
        this.equations = equations;
        this.width = width;
        this.height = height;
        this.boundry_left = boundry_left;
        this.boundry_right = boundry_right;
        this.boundry_bottom = boundry_bottom;
        this.boundry_top = boundry_top;
        this.hash = crypto.createHash("sha256")
            .update(JSON.stringify(this))
            .digest("hex");
    }
    static parse(source) {
        const split = source.split("---");
        // Welcome to ternary hell, have a nice stay
        const equations = split.length == 0
            ? []
            : split.length == 1
                ? split[0].split("\n").filter(Boolean)
                : split.length == 2
                    ? split[1].split("\n").filter(Boolean)
                    : null;
        if (equations == null) {
            throw new SyntaxError("Too many segments");
        }
        const settings = split.length == 2
            ? split[0]
                .split(";")
                .map((setting) => setting.trim())
                .filter(Boolean) // remove any empty elements
                .map((setting) => setting.split("=").map((e) => e.trim()))
                .reduce((settings, setting) => {
                const s = parseInt(setting[1]);
                settings[setting[0]] = s === NaN ? undefined : s;
                return settings;
            }, {})
            : {};
        // Ensure boundaries are complete
        // (basically ensure if we have one value then we also have the other)
        if ((settings.boundry_left === undefined) ==
            (settings.boundry_right != undefined)) {
            throw new SyntaxError("Incomplete boundaries: If you specify one boundry you must also specify the other (boundry_left, boundry_right");
        }
        if ((settings.boundry_bottom === undefined) ==
            (settings.boundry_top != undefined)) {
            throw new SyntaxError("Incomplete boundaries: If you specify one boundry you must also specify the other (boundry_bottom, boundry_top");
        }
        return new Dsl(equations, settings.width, settings.height, settings.boundry_left, settings.boundry_right, settings.boundry_top, settings.boundry_bottom);
    }
}

function renderError(err, el) {
    el.innerHTML = `
    <div style="padding: 20px; background-color: #f44336; color: white;">
        <strong>Desmos Graph Error:</strong> ${err}
    </div>`;
}

class Renderer {
    static render(args, settings, el, vault_root) {
        const { height, width, equations, hash } = args;
        const cache_dir = settings.cache_directory
            ? path__default['default'].isAbsolute(settings.cache_directory)
                ? settings.cache_directory
                : path__default['default'].join(vault_root, settings.cache_directory)
            : os.tmpdir();
        const cache_target = path__default['default'].join(cache_dir, `desmos-graph-${hash}.png`);
        // If this graph is in the cache then fetch it
        if (settings.cache && fs.existsSync(cache_target)) {
            fs.promises.readFile(cache_target).then((data) => {
                const b64 = "data:image/png;base64," +
                    Buffer.from(data).toString("base64");
                const img = document.createElement("img");
                img.src = b64;
                el.appendChild(img);
            });
            return;
        }
        const expressions = equations.map((equation) => `calculator.setExpression({ latex: "${equation.replace("\\", "\\\\")}" });`);
        // Because of the electron sandboxing we have to do this inside an iframe,
        // otherwise we can't include the desmos API (although it would be nice if they had a REST API of some sort)
        const html_src_head = `<script src="https://www.desmos.com/api/v1.6/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>`;
        const html_src_body = `
            <div id="calculator" style="width: ${width}px; height: ${height}px;"></div>
            <script>
                const options = {
                    settingsMenu: false,
                    expressions: false,
                    lockViewPort: true,
                    zoomButtons: false,
                    trace: false,
                };

                const calculator = Desmos.GraphingCalculator(document.getElementById("calculator"), options);
                calculator.setMathBounds({
                    left: ${args.boundry_left},
                    right: ${args.boundry_right},
                    top: ${args.boundry_top},
                    bottom: ${args.boundry_bottom},
                });
                
                ${expressions.join("")}

                calculator.observe("expressionAnalysis", () => {
                    for (const id in calculator.expressionAnalysis) {
                        const analysis = calculator.expressionAnalysis[id];
                        if (analysis.isError) {
                            parent.postMessage({ t: "desmos-graph", d: "error", data: analysis.errorMessage });
                        }
                    }
                });

                calculator.asyncScreenshot({ showLabels: true, format: "png" }, (data) => {
                    document.body.innerHTML = "";
                    parent.postMessage({ t: "desmos-graph", d: "render", data }, "app://obsidian.md");                    
                });
            </script>
        `;
        const html_src = `<html><head>${html_src_head}</head><body>${html_src_body}</body>`;
        const iframe = document.createElement("iframe");
        iframe.width = width.toString();
        iframe.height = height.toString();
        iframe.style.border = "none";
        iframe.scrolling = "no"; // fixme use a non-depreciated function
        iframe.srcdoc = html_src;
        // iframe.style.display = "none"; //fixme hiding the iframe breaks the positioning
        el.appendChild(iframe);
        const handler = (message) => {
            if (message.origin === "app://obsidian.md" &&
                message.data.t === "desmos-graph") {
                el.empty();
                if (message.data.d === "error") {
                    renderError(message.data.data, el);
                }
                if (message.data.d === "render") {
                    const { data } = message.data;
                    window.removeEventListener("message", handler);
                    const img = document.createElement("img");
                    img.src = data;
                    el.appendChild(img);
                    if (settings.cache) {
                        if (fs.existsSync(cache_dir)) {
                            fs.promises.writeFile(cache_target, data.replace(/^data:image\/png;base64,/, ""), "base64").catch((err) => new obsidian.Notice(`desmos-graph: unexpected error when trying to cache graph: ${err}`, 10000));
                        }
                        else {
                            new obsidian.Notice(`desmos-graph: cache directory not found: '${cache_dir}'`, 10000);
                        }
                    }
                }
            }
        };
        window.addEventListener("message", handler);
    }
}

const DEFAULT_SETTINGS = {
    cache: false,
    cache_directory: null,
};
class SettingsTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName("Cache")
            .setDesc("Whether to cache the rendered graphs locally")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.cache)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.cache = value;
            yield this.plugin.saveSettings();
            // Reset the display so the new state can render
            this.display();
        })));
        if (this.plugin.settings.cache) {
            new obsidian.Setting(containerEl)
                .setName("Cache Directory")
                .setDesc("The directory to save cached graphs in (technical note: the graphs will be saved as `desmos-graph-<hash>.png` where the name is a SHA-256 hash of the graph source). The default directory is the system tempdir for your current operating system, and this value may be either a path relative to the root of your vault or an absolute path.")
                .addText((text) => text
                .setPlaceholder(os.tmpdir())
                .setValue(this.plugin.settings.cache_directory)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.cache_directory = value;
                yield this.plugin.saveSettings();
            })));
        }
    }
}

class Desmos extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            this.registerMarkdownCodeBlockProcessor("desmos-graph", 
            // Only render the graph after the user stops typing for 500ms
            // debounce(
            (source, el, _) => {
                try {
                    const vault_root = this.app.vault.adapter.basePath;
                    Renderer.render(Dsl.parse(source), this.settings, el, vault_root);
                }
                catch (err) {
                    renderError(err.message, el);
                }
            });
            this.addSettingTab(new SettingsTab(this.app, this));
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
}

module.exports = Desmos;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9kc2wudHMiLCJzcmMvZXJyb3IudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6bnVsbCwibmFtZXMiOlsiY3JlYXRlSGFzaCIsInBhdGgiLCJ0bXBkaXIiLCJleGlzdHNTeW5jIiwiZnMiLCJOb3RpY2UiLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXVEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxD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
