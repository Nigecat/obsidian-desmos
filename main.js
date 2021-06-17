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
        return new Dsl(equations, settings.width, settings.height, settings.boundry_left, settings.boundry_right, settings.boundry_bottom, settings.boundry_top);
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
    debounce: 500,
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
            .setName("Debounce Time (ms)")
            .setDesc("How long to wait after a keypress to render the graph (requires restart to take affect)")
            .addText((text) => text
            .setValue(this.plugin.settings.debounce.toString())
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            const val = parseInt(value);
            this.plugin.settings.debounce =
                val === NaN ? DEFAULT_SETTINGS.debounce : val;
            yield this.plugin.saveSettings();
        })));
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
            this.addSettingTab(new SettingsTab(this.app, this));
            // Keep track of the total number of graphs in each file
            // This allows us to skip the debounce on recently opened files to make it feel snappier to use
            let total = 0;
            this.app.workspace.on("file-open", (file) => __awaiter(this, void 0, void 0, function* () {
                const contents = yield this.app.vault.cachedRead(file);
                // Attempt to figure out the number of graphs there are in this file
                // In this case it is fine if we overestimate because we only need a general idea since this just makes it skip the debounce
                total = (contents.match(/```desmos-graph/g) || []).length;
            }));
            const render = (source, el) => {
                try {
                    const vault_root = this.app.vault.adapter
                        .basePath;
                    Renderer.render(Dsl.parse(source), this.settings, el, vault_root);
                }
                catch (err) {
                    renderError(err.message, el);
                }
            };
            const debounce_render = obsidian.debounce((source, el) => render(source, el), this.settings.debounce);
            this.registerMarkdownCodeBlockProcessor("desmos-graph", (source, el) => {
                if (total > 0) {
                    total--;
                    // Skip the debounce on initial render
                    render(source, el);
                }
                else {
                    debounce_render(source, el);
                }
            });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9kc2wudHMiLCJzcmMvZXJyb3IudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6bnVsbCwibmFtZXMiOlsiY3JlYXRlSGFzaCIsInBhdGgiLCJ0bXBkaXIiLCJleGlzdHNTeW5jIiwiZnMiLCJOb3RpY2UiLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIlBsdWdpbiIsImRlYm91bmNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBdURBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ2hILElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQy9ELFFBQVEsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNuRyxRQUFRLFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUN0RyxRQUFRLFNBQVMsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRTtBQUN0SCxRQUFRLElBQUksQ0FBQyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxVQUFVLElBQUksRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUM5RSxLQUFLLENBQUMsQ0FBQztBQUNQOztNQzNFYSxHQUFHO0lBSVosWUFDb0IsWUFBc0IsRUFBRSxFQUN4QixRQUFnQixHQUFHLEVBQ25CLFNBQWlCLEdBQUcsRUFDcEIsZUFBZSxDQUFDLEVBQUUsRUFDbEIsZ0JBQWdCLEVBQUUsRUFDbEIsaUJBQWlCLENBQUMsQ0FBQyxFQUNuQixjQUFjLENBQUM7UUFOZixjQUFTLEdBQVQsU0FBUyxDQUFlO1FBQ3hCLFVBQUssR0FBTCxLQUFLLENBQWM7UUFDbkIsV0FBTSxHQUFOLE1BQU0sQ0FBYztRQUNwQixpQkFBWSxHQUFaLFlBQVksQ0FBTTtRQUNsQixrQkFBYSxHQUFiLGFBQWEsQ0FBSztRQUNsQixtQkFBYyxHQUFkLGNBQWMsQ0FBSztRQUNuQixnQkFBVyxHQUFYLFdBQVcsQ0FBSTtRQUUvQixJQUFJLENBQUMsSUFBSSxHQUFHQSxpQkFBVSxDQUFDLFFBQVEsQ0FBQzthQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUM1QixNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDdEI7SUFFRCxPQUFPLEtBQUssQ0FBQyxNQUFjO1FBQ3ZCLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7O1FBR2xDLE1BQU0sU0FBUyxHQUNYLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQztjQUNYLEVBQUU7Y0FDRixLQUFLLENBQUMsTUFBTSxJQUFJLENBQUM7a0JBQ2pCLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztrQkFDcEMsS0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDO3NCQUNqQixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7c0JBQ3BDLElBQUksQ0FBQztRQUVmLElBQUksU0FBUyxJQUFJLElBQUksRUFBRTtZQUNuQixNQUFNLElBQUksV0FBVyxDQUFDLG1CQUFtQixDQUFDLENBQUM7U0FDOUM7UUFFRCxNQUFNLFFBQVEsR0FDVixLQUFLLENBQUMsTUFBTSxJQUFJLENBQUM7Y0FDWCxLQUFLLENBQUMsQ0FBQyxDQUFDO2lCQUNILEtBQUssQ0FBQyxHQUFHLENBQUM7aUJBQ1YsR0FBRyxDQUFDLENBQUMsT0FBTyxLQUFLLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztpQkFDaEMsTUFBTSxDQUFDLE9BQU8sQ0FBQztpQkFDZixHQUFHLENBQUMsQ0FBQyxPQUFPLEtBQUssT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7aUJBQ3pELE1BQU0sQ0FBQyxDQUFDLFFBQVEsRUFBRSxPQUFPO2dCQUN0QixNQUFNLENBQUMsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQy9CLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssR0FBRyxHQUFHLFNBQVMsR0FBRyxDQUFDLENBQUM7Z0JBQ2pELE9BQU8sUUFBUSxDQUFDO2FBQ25CLEVBQUUsRUFBNEIsQ0FBQztjQUNwQyxFQUFFLENBQUM7OztRQUliLElBQ0ksQ0FBQyxRQUFRLENBQUMsWUFBWSxLQUFLLFNBQVM7YUFDbkMsUUFBUSxDQUFDLGFBQWEsSUFBSSxTQUFTLENBQUMsRUFDdkM7WUFDRSxNQUFNLElBQUksV0FBVyxDQUNqQixnSEFBZ0gsQ0FDbkgsQ0FBQztTQUNMO1FBQ0QsSUFDSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEtBQUssU0FBUzthQUNyQyxRQUFRLENBQUMsV0FBVyxJQUFJLFNBQVMsQ0FBQyxFQUNyQztZQUNFLE1BQU0sSUFBSSxXQUFXLENBQ2pCLGdIQUFnSCxDQUNuSCxDQUFDO1NBQ0w7UUFFRCxPQUFPLElBQUksR0FBRyxDQUNWLFNBQVMsRUFDVCxRQUFRLENBQUMsS0FBSyxFQUNkLFFBQVEsQ0FBQyxNQUFNLEVBQ2YsUUFBUSxDQUFDLFlBQVksRUFDckIsUUFBUSxDQUFDLGFBQWEsRUFDdEIsUUFBUSxDQUFDLGNBQWMsRUFDdkIsUUFBUSxDQUFDLFdBQVcsQ0FDdkIsQ0FBQztLQUNMOzs7U0MvRVcsV0FBVyxDQUFDLEdBQVcsRUFBRSxFQUFlO0lBQ3BELEVBQUUsQ0FBQyxTQUFTLEdBQUc7OytDQUU0QixHQUFHO1dBQ3ZDLENBQUM7QUFDWjs7TUNHYSxRQUFRO0lBQ2pCLE9BQU8sTUFBTSxDQUNULElBQVMsRUFDVCxRQUFrQixFQUNsQixFQUFlLEVBQ2YsVUFBa0I7UUFFbEIsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQztRQUVoRCxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsZUFBZTtjQUNwQ0Msd0JBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQztrQkFDckMsUUFBUSxDQUFDLGVBQWU7a0JBQ3hCQSx3QkFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQztjQUNuREMsU0FBTSxFQUFFLENBQUM7UUFFZixNQUFNLFlBQVksR0FBR0Qsd0JBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLGdCQUFnQixJQUFJLE1BQU0sQ0FBQyxDQUFDOztRQUd0RSxJQUFJLFFBQVEsQ0FBQyxLQUFLLElBQUlFLGFBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtZQUM1Q0MsV0FBRSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJO2dCQUNoQyxNQUFNLEdBQUcsR0FDTCx3QkFBd0I7b0JBQ3hCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN6QyxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUMxQyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztnQkFDZCxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQ3ZCLENBQUMsQ0FBQztZQUNILE9BQU87U0FDVjtRQUVELE1BQU0sV0FBVyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQzdCLENBQUMsUUFBUSxLQUNMLHNDQUFzQyxRQUFRLENBQUMsT0FBTyxDQUNsRCxJQUFJLEVBQ0osTUFBTSxDQUNULE9BQU8sQ0FDZixDQUFDOzs7UUFJRixNQUFNLGFBQWEsR0FBRywrR0FBK0csQ0FBQztRQUN0SSxNQUFNLGFBQWEsR0FBRztpREFDbUIsS0FBSyxlQUFlLE1BQU07Ozs7Ozs7Ozs7Ozs0QkFZL0MsSUFBSSxDQUFDLFlBQVk7NkJBQ2hCLElBQUksQ0FBQyxhQUFhOzJCQUNwQixJQUFJLENBQUMsV0FBVzs4QkFDYixJQUFJLENBQUMsY0FBYzs7O2tCQUcvQixXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7OztTQWdCN0IsQ0FBQztRQUNGLE1BQU0sUUFBUSxHQUFHLGVBQWUsYUFBYSxnQkFBZ0IsYUFBYSxTQUFTLENBQUM7UUFFcEYsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNoRCxNQUFNLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNoQyxNQUFNLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNsQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDN0IsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDeEIsTUFBTSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUM7O1FBR3pCLEVBQUUsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFdkIsTUFBTSxPQUFPLEdBQUcsQ0FDWixPQUE2RDtZQUU3RCxJQUNJLE9BQU8sQ0FBQyxNQUFNLEtBQUssbUJBQW1CO2dCQUN0QyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxjQUFjLEVBQ25DO2dCQUNFLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFFWCxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLE9BQU8sRUFBRTtvQkFDNUIsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2lCQUN0QztnQkFFRCxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLFFBQVEsRUFBRTtvQkFDN0IsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7b0JBQzlCLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7b0JBRS9DLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQzFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO29CQUNmLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBRXBCLElBQUksUUFBUSxDQUFDLEtBQUssRUFBRTt3QkFDaEIsSUFBSUQsYUFBVSxDQUFDLFNBQVMsQ0FBQyxFQUFFOzRCQUN2QkMsV0FBRSxDQUFDLFNBQVMsQ0FDUixZQUFZLEVBQ1osSUFBSSxDQUFDLE9BQU8sQ0FBQywwQkFBMEIsRUFBRSxFQUFFLENBQUMsRUFDNUMsUUFBUSxDQUNYLENBQUMsS0FBSyxDQUNILENBQUMsR0FBRyxLQUNBLElBQUlDLGVBQU0sQ0FDTiw4REFBOEQsR0FBRyxFQUFFLEVBQ25FLEtBQUssQ0FDUixDQUNSLENBQUM7eUJBQ0w7NkJBQU07NEJBQ0gsSUFBSUEsZUFBTSxDQUNOLDZDQUE2QyxTQUFTLEdBQUcsRUFDekQsS0FBSyxDQUNSLENBQUM7eUJBQ0w7cUJBQ0o7aUJBQ0o7YUFDSjtTQUNKLENBQUM7UUFFRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQy9DOzs7QUNySUUsTUFBTSxnQkFBZ0IsR0FBYTtJQUN0QyxRQUFRLEVBQUUsR0FBRztJQUNiLEtBQUssRUFBRSxLQUFLO0lBQ1osZUFBZSxFQUFFLElBQUk7Q0FDeEIsQ0FBQztNQUVXLFdBQVksU0FBUUMseUJBQWdCO0lBRzdDLFlBQVksR0FBUSxFQUFFLE1BQWM7UUFDaEMsS0FBSyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNuQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztLQUN4QjtJQUVELE9BQU87UUFDSCxJQUFJLEVBQUUsV0FBVyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBRTNCLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUVwQixJQUFJQyxnQkFBTyxDQUFDLFdBQVcsQ0FBQzthQUNuQixPQUFPLENBQUMsb0JBQW9CLENBQUM7YUFDN0IsT0FBTyxDQUNKLHlGQUF5RixDQUM1RjthQUNBLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FDVixJQUFJO2FBQ0MsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQzthQUNsRCxRQUFRLENBQUMsQ0FBTyxLQUFLO1lBQ2xCLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM1QixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRO2dCQUN6QixHQUFHLEtBQUssR0FBRyxHQUFHLGdCQUFnQixDQUFDLFFBQVEsR0FBRyxHQUFHLENBQUM7WUFDbEQsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ3BDLENBQUEsQ0FBQyxDQUNULENBQUM7UUFFTixJQUFJQSxnQkFBTyxDQUFDLFdBQVcsQ0FBQzthQUNuQixPQUFPLENBQUMsT0FBTyxDQUFDO2FBQ2hCLE9BQU8sQ0FBQyw4Q0FBOEMsQ0FBQzthQUN2RCxTQUFTLENBQUMsQ0FBQyxNQUFNLEtBQ2QsTUFBTTthQUNELFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7YUFDcEMsUUFBUSxDQUFDLENBQU8sS0FBSztZQUNsQixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1lBQ25DLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQzs7WUFHakMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1NBQ2xCLENBQUEsQ0FBQyxDQUNULENBQUM7UUFFTixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRTtZQUM1QixJQUFJQSxnQkFBTyxDQUFDLFdBQVcsQ0FBQztpQkFDbkIsT0FBTyxDQUFDLGlCQUFpQixDQUFDO2lCQUMxQixPQUFPLENBQ0osaVZBQWlWLENBQ3BWO2lCQUNBLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FDVixJQUFJO2lCQUNDLGNBQWMsQ0FBQ0wsU0FBTSxFQUFFLENBQUM7aUJBQ3hCLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUM7aUJBQzlDLFFBQVEsQ0FBQyxDQUFPLEtBQUs7Z0JBQ2xCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUM7Z0JBQzdDLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQzthQUNwQyxDQUFBLENBQUMsQ0FDVCxDQUFDO1NBQ1Q7S0FDSjs7O01DdEVnQixNQUFPLFNBQVFNLGVBQU07SUFHaEMsTUFBTTs7WUFDUixNQUFNLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUMxQixJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQzs7O1lBSXBELElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztZQUNkLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBTyxJQUFJO2dCQUMxQyxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQzs7O2dCQUl2RCxLQUFLLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxFQUFFLE1BQU0sQ0FBQzthQUM3RCxDQUFBLENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxHQUFHLENBQUMsTUFBYyxFQUFFLEVBQWU7Z0JBQzNDLElBQUk7b0JBQ0EsTUFBTSxVQUFVLEdBQVksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBZTt5QkFDckQsUUFBUSxDQUFDO29CQUNkLFFBQVEsQ0FBQyxNQUFNLENBQ1gsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFDakIsSUFBSSxDQUFDLFFBQVEsRUFDYixFQUFFLEVBQ0YsVUFBVSxDQUNiLENBQUM7aUJBQ0w7Z0JBQUMsT0FBTyxHQUFHLEVBQUU7b0JBQ1YsV0FBVyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7aUJBQ2hDO2FBQ0osQ0FBQztZQUNGLE1BQU0sZUFBZSxHQUFHQyxpQkFBUSxDQUM1QixDQUFDLE1BQWMsRUFBRSxFQUFlLEtBQUssTUFBTSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFDdkQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQ3pCLENBQUM7WUFDRixJQUFJLENBQUMsa0NBQWtDLENBQ25DLGNBQWMsRUFDZCxDQUFDLE1BQU0sRUFBRSxFQUFFO2dCQUNQLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRTtvQkFDWCxLQUFLLEVBQUUsQ0FBQzs7b0JBRVIsTUFBTSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztpQkFDdEI7cUJBQU07b0JBQ0gsZUFBZSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztpQkFDL0I7YUFDSixDQUNKLENBQUM7U0FDTDtLQUFBO0lBRUssWUFBWTs7WUFDZCxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQ3pCLEVBQUUsRUFDRixnQkFBZ0IsRUFDaEIsTUFBTSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQ3hCLENBQUM7U0FDTDtLQUFBO0lBRUssWUFBWTs7WUFDZCxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ3RDO0tBQUE7Ozs7OyJ9
