import { Dsl } from "./dsl";
import { Plugin } from "obsidian";
import { Renderer } from "./renderer";
import { renderError } from "./error";
import { Settings, SettingsTab, DEFAULT_SETTINGS } from "./settings";

export default class Desmos extends Plugin {
    settings: Settings;

    async onload() {
        await this.loadSettings();

        this.registerMarkdownCodeBlockProcessor(
            "desmos-graph",
            (source, el, _) => {
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
            }
        );
        this.addSettingTab(new SettingsTab(this.app, this));
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
