import { Graph } from "./graph";
import { normalizePath, Plugin } from "obsidian";
import { Renderer } from "./renderer";
import { renderError } from "./error";
import { DEFAULT_SETTINGS, migrateSettings, Settings, SettingsTab } from "./settings";

export default class Desmos extends Plugin {
    // We load the settings before accessing them, so we can ensure this object always exists
    settings!: Settings;

    // We create the renderer before registering the codeblock, so we can ensure this object always exists
    renderer!: Renderer;

    /** Helper for in-memory graph caching */
    graphCache: Record<string, string> = {};

    /** A cache that stores the Desmos API */
    desmosApiCache: string | null = null;

    async onload() {
        await this.loadSettings();
        this.renderer = new Renderer(this);
        this.renderer.activate();

        this.addSettingTab(new SettingsTab(this.app, this));

        this.registerMarkdownCodeBlockProcessor("desmos-graph", async (source, el) => {
            try {
                const graph = Graph.parse(source);
                await this.renderer.render(graph, el);
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

        this.tryCacheDesmosApi(); // note: we don't want to error here if this fails
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

    async tryCacheDesmosApi(): Promise<string> {
        const api_version = "v1.9"; // todo move this to the config
        const api = `https://www.desmos.com/api/${api_version}/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6`;

        if (normalizePath == null) {
            // This means we are most likely in the testing environment;
            //   disable caching
            return await (await fetch(api)).text();
        }

        const dir = normalizePath(`.obsidian/plugins/${this.manifest.id}/vendor`);
        if (!(await app.vault.adapter.exists(dir))) {
            await app.vault.adapter.mkdir(dir);
        }

        // Return cached file if it exists
        const path = normalizePath(`.obsidian/plugins/${this.manifest.id}/vendor/desmos.js`);
        if (await app.vault.adapter.exists(path)) {
            this.desmosApiCache = await app.vault.adapter.read(path);
            return this.desmosApiCache;
        }

        // Otherwise, download it
        try {
            this.desmosApiCache = await (await fetch(api)).text();
            await app.vault.adapter.write(path, this.desmosApiCache);
            return this.desmosApiCache;
        } catch (err) {
            console.warn(err);
            throw new Error(
                "Unable to locate or download the Desmos API. If you don't have an internet connection: try rendering a graph whilst connected. If you have an internet connection: you may be on an unsupported device, please open an issue at https://github.com/Nigecat/obsidian-desmos/"
            );
        }
    }
}
