import { Dsl } from "./dsl";
import { Renderer } from "./renderer";
import { renderError } from "./error";
import { debounce, Plugin } from "obsidian";
import {
    DEFAULT_SETTINGS,
    migrateSettings,
    Settings,
    SettingsTab,
} from "./settings";

export default class Desmos extends Plugin {
    settings: Settings;
    /** Helper for in-memory graph caching */
    graph_cache: Record<string, string>;
    /** Whether to skip the debounce event */
    skip_debounce: boolean;

    async onload() {
        this.graph_cache = {};
        this.skip_debounce = false;
        await this.loadSettings();
        this.addSettingTab(new SettingsTab(this.app, this));

        // Skip debounce after a layout change
        this.registerEvent(
            this.app.workspace.on(
                "layout-change",
                () => (this.skip_debounce = true)
            )
        );

        this.app.workspace.activeLeaf;

        const render = async (
            source: string,
            el: HTMLElement
        ): Promise<void> => {
            try {
                return Renderer.render(
                    Dsl.parse(source),
                    this.settings,
                    el,
                    this
                );
            } catch (err) {
                renderError(err.message, el);
            }
        };
        const debounce_render = debounce(
            (source: string, el: HTMLElement) => render(source, el),
            this.settings.debounce
        );
        this.registerMarkdownCodeBlockProcessor(
            "desmos-graph",
            (source, el) => {
                if (
                    this.skip_debounce ||
                    !this.settings.debounce ||
                    this.settings.debounce < 1
                ) {
                    this.skip_debounce = false;
                    return render(source, el);
                } else {
                    return debounce_render(source, el);
                }
            }
        );
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
