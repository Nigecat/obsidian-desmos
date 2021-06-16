import { tmpdir } from "os";
import Desmos from "./main";
import { PluginSettingTab, App, Setting } from "obsidian";

export interface Settings {
    cache: boolean;
    cache_directory: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
    cache: false,
    cache_directory: null,
};

export class SettingsTab extends PluginSettingTab {
    plugin: Desmos;

    constructor(app: App, plugin: Desmos) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        let { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("Cache")
            .setDesc("Whether to cache the rendered graphs locally")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.cache)
                    .onChange(async (value) => {
                        this.plugin.settings.cache = value;
                        await this.plugin.saveSettings();

                        // Reset the display so the new state can render
                        this.display();
                    })
            );

        if (this.plugin.settings.cache) {
            new Setting(containerEl)
                .setName("Cache Directory")
                .setDesc(
                    "The directory to save cached graphs in (technical note: the graphs will be saved as `desmos-graph-<hash>.png` where the name is a SHA-256 hash of the graph source). The default directory is the system tempdir for your current operating system, and this value may be either a path relative to the root of your vault or an absolute path."
                )
                .addText((text) =>
                    text
                        .setPlaceholder(tmpdir())
                        .setValue(this.plugin.settings.cache_directory)
                        .onChange(async (value) => {
                            this.plugin.settings.cache_directory = value;
                            await this.plugin.saveSettings();
                        })
                );
        }
    }
}
