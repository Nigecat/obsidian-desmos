import { Renderer } from "./renderer";
import { renderError } from "./error";
import { Plugin, debounce } from "obsidian";
import { Graph, GraphSettings } from "./graph";
import { DEFAULT_SETTINGS, migrateSettings, Settings, SettingsTab } from "./settings";

export default class Desmos extends Plugin {
    // We load the settings before accessing them, so we can ensure this object always exists
    settings!: Settings;

    // We create the renderer before registering the codeblock, so we can ensure this object always exists
    renderer!: Renderer;

    /** Helper for in-memory graph caching */
    graphCache: Record<string, string> = {};

    async onload() {
        await this.loadSettings();
        this.renderer = new Renderer(this);
        this.renderer.activate();

        this.addSettingTab(new SettingsTab(this.app, this));

        this.registerMarkdownCodeBlockProcessor("desmos-graph", async (source, el, ctx) => {
            try {
                const graph = Graph.parse(source);

                // Determine whether live mode should be enabled for this graph
                const live = graph.settings.lock ? false : graph.settings.live || this.settings.live;

                // If live mode is enabled, generate an update function using the specific context of this markdown codeblock
                const update = live
                    ? debounce(
                          (data: Partial<GraphSettings>) => graph.update({ target: el, ctx, plugin: this }, data),
                          500
                      )
                    : undefined;

                if (update) {
                    // Trigger an empty update event,
                    //  this will ensure that any errors will be caught before the user attempts to modify the graph
                    graph.update(
                        { target: el, ctx, plugin: this },
                        {
                            left: graph.settings.left,
                            right: graph.settings.right,
                            top: graph.settings.top,
                            bottom: graph.settings.bottom,
                        },
                        false
                    );
                }

                await this.renderer.render(graph, el, update);
            } catch (err) {
                if (err instanceof Error) {
                    renderError(err.message, el);
                } else if (typeof err === "string") {
                    renderError(err, el);
                } else {
                    renderError("Unexpected error - see console for debug log", el);
                    console.error(err);
                }
            }
        });
    }

    async unload() {
        this.renderer.deactivate();
    }

    async loadSettings() {
        let settings = await this.loadData();

        if (!settings) {
            settings = DEFAULT_SETTINGS(this);
        }

        if (settings.version !== this.manifest.version) {
            settings = migrateSettings(this, settings);
        }

        this.settings = settings;
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
