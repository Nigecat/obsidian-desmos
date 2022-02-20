import { tmpdir } from "os";
import Desmos from "./main";
import { PluginSettingTab, App, Setting } from "obsidian";

export interface Settings {
    debounce: number;
    cache: boolean;
    cache_location: "memory" | "filesystem";
    cache_directory: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
    debounce: 500,
    cache: true,
    cache_location: "memory",
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
            .setName("Debounce Time (ms)")
            .setDesc(
                "How long to wait after a keypress to render the graph (requires restart to take effect)"
            )
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.debounce.toString())
                    .onChange(async (value) => {
                        const val = parseInt(value);
                        this.plugin.settings.debounce =
                            val === NaN ? DEFAULT_SETTINGS.debounce : val;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Cache")
            .setDesc("Whether to cache the rendered graphs")
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
                .setName("Cache in memory (alternate: filesystem)")
                .setDesc(
                    "Cache rendered graphs in memory or on the filesystem (note that memory caching is not persistent)."
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(
                            this.plugin.settings.cache_location === "memory"
                                ? true
                                : false
                        )
                        .onChange(async (value) => {
                            this.plugin.settings.cache_location = value
                                ? "memory"
                                : "filesystem";
                            await this.plugin.saveSettings();

                            // Reset the display so the new state can render
                            this.display();
                        })
                );

            if (this.plugin.settings.cache_location == "filesystem") {
                new Setting(containerEl)
                    .setName("Cache Directory")
                    .setDesc(
                        "The directory to save cached graphs in (technical note: the graphs will be saved as `desmos-graph-<hash>.png` where the name is a SHA-256 hash of the graph source). The default directory is the system tempdir for your current operating system, and this value may be either a path relative to the root of your vault or an absolute path. Also note that a lot of junk will be saved to this folder, you have been warned."
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
}
