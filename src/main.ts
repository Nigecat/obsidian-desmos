import { Dsl } from "./dsl";
import { Plugin } from "obsidian";
import { Renderer } from "./renderer";
import { renderError } from "./error";
import { DEFAULT_SETTINGS, migrateSettings, Settings, SettingsTab } from "./settings";

export default class Desmos extends Plugin {
    // @ts-ignore - we load the settings before accessing them, so we can ensure this object always exists
    settings: Settings;
    /** Helper for in-memory graph caching */
    graph_cache: Record<string, string> = {};

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new SettingsTab(this.app, this));

        this.registerMarkdownCodeBlockProcessor("desmos-graph", async (source, el) => {
            try {
                const args = Dsl.parse(source);
                await Renderer.render(args, this.settings, el, this);
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
