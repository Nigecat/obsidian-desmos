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
    constructor(width = "600", height = "400", equations = []) {
        this.width = width;
        this.height = height;
        this.equations = equations;
        this.hash = crypto.createHash("sha256")
            .update(`(${width}x${height})-${equations}`)
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
                settings[setting[0]] = setting[1];
                return settings;
            }, {})
            : {};
        return new Dsl(settings.width, settings.height, equations);
    }
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
                ${expressions.join("")}

                calculator.asyncScreenshot({ showLabels: true, format: "png" }, (data) => {
                    document.body.innerHTML = "";
                    parent.postMessage({ t: "desmos-graph", data, hash: "${hash}" }, "app://obsidian.md");                    
                });
            </script>
        `;
        const html_src = `<html><head>${html_src_head}</head><body>${html_src_body}</body>`;
        const iframe = document.createElement("iframe");
        iframe.width = width;
        iframe.height = height;
        iframe.style.border = "none";
        iframe.scrolling = "no"; // fixme use a non-depreciated function
        iframe.srcdoc = html_src;
        // iframe.style.display = "none"; //fixme hiding the iframe breaks the positioning
        el.appendChild(iframe);
        const handler = (message) => {
            if (message.origin === "app://obsidian.md" &&
                message.data.t === "desmos-graph") {
                const { hash, data } = message.data;
                window.removeEventListener("message", handler);
                const img = document.createElement("img");
                img.src = data;
                el.empty();
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
        };
        window.addEventListener("message", handler);
    }
}

function renderError(err, el) {
    el.innerHTML = `
    <div style="padding: 20px; background-color: #f44336; color: white;">
        <strong>Desmos Graph Error:</strong> ${err}
    </div>`;
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
            this.registerMarkdownCodeBlockProcessor("desmos-graph", (source, el, _) => {
                try {
                    const vault_root = this.app.vault.adapter
                        .basePath;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9kc2wudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvZXJyb3IudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6bnVsbCwibmFtZXMiOlsiY3JlYXRlSGFzaCIsInBhdGgiLCJ0bXBkaXIiLCJleGlzdHNTeW5jIiwiZnMiLCJOb3RpY2UiLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXVEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxD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
