import { Dsl } from "./dsl";
import { debounce, Plugin } from "obsidian";
import { Renderer } from "./renderer";
import { renderError } from "./error";
import { Settings, SettingsTab, DEFAULT_SETTINGS } from "./settings";

export default class Desmos extends Plugin {
    settings: Settings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new SettingsTab(this.app, this));

        // Keep track of the total number of graphs in each file
        // This allows us to skip the debounce on recently opened files to make it feel snappier to use
        let total = 0;
        this.app.workspace.on("file-open", async (file) => {
            const contents = await this.app.vault.cachedRead(file);

            // Attempt to figure out the number of graphs there are in this file
            // In this case it is fine if we overestimate because we only need a general idea since this just makes it skip the debounce
            total = (contents.match(/```desmos-graph/g) || []).length;
        });

        const render = (source: string, el: HTMLElement) => {
            try {
                const vault_root: string = (this.app.vault.adapter as any)
                    .basePath;
                Renderer.render(
                    Dsl.parse(source),
                    this.settings,
                    el,
                    vault_root
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
                if (total > 0) {
                    total--;
                    // Skip the debounce on initial render
                    render(source, el);
                } else {
                    debounce_render(source, el);
                }
            }
        );
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
