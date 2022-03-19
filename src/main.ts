import { Dsl } from "./dsl";
import { Renderer } from "./renderer";
import { renderError } from "./error";
import { debounce, Plugin } from "obsidian";
import {
    CacheLocation,
    DEFAULT_SETTINGS,
    migrateSettings,
    Settings,
    SettingsTab,
} from "./settings";

export default class Desmos extends Plugin {
    settings: Settings;
    /** Helper for in-memory graph caching */
    graph_cache: Record<string, string> = {};
    /** Whether to skip the debounce event */
    skip_debounce: boolean = false;

    async onload() {
        this.addSettingTab(new SettingsTab(this.app, this));

        // Skip debounce after a layout change
        this.registerEvent(
            this.app.workspace.on(
                "layout-change",
                () => (this.skip_debounce = true)
            )
        );

        // Wait until the settings are loaded before registering the codeblock
        this.loadSettings().then(() => {
            const renderGraph = async (
                args: Dsl,
                el: HTMLElement
            ): Promise<void> => {
                try {
                    await Renderer.render(args, this.settings, el, this);
                } catch (err) {
                    renderError(err.message, el);
                }
            };

            const renderGraphDebounced = debounce(
                (args: Dsl, el: HTMLElement) => renderGraph(args, el),
                this.settings.debounce
            );

            this.registerMarkdownCodeBlockProcessor(
                "desmos-graph",
                async (source, el) => {
                    let args;

                    try {
                        args = Dsl.parse(source);
                    } catch (err) {
                        renderError(err.message, el);
                        return;
                    }

                    // Skip debounce if graph in cache
                    if (
                        this.settings.cache.enabled &&
                        this.settings.cache.location == CacheLocation.Memory &&
                        args.hash in this.graph_cache
                    ) {
                        await renderGraph(args, el);
                    } else if (
                        this.skip_debounce ||
                        !this.settings.debounce ||
                        this.settings.debounce < 1
                    ) {
                        this.skip_debounce = false;
                        await renderGraph(args, el);
                    } else {
                        renderGraphDebounced(args, el);
                    }
                }
            );
        });
    }

    async loadSettings() {
        let settings = await this.loadData();

        if (!settings) {
            settings = DEFAULT_SETTINGS(this);
        }

        if (settings.version != this.manifest.version) {
            settings = migrateSettings(this, settings);
        }

        this.settings = settings;
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
