/* eslint-disable */
// Type stubs for test framework

var module = {};
window.origin = "*";

/* ---------- Obsidian ---------- */

// Prototype provided by Obsidian; empty element children
Node.prototype.empty = function () {
    while (this.firstChild) {
        this.removeChild(this.firstChild);
    }
};

class Plugin {
    manifest = { version: "0.0.0" };
    codeblock = {};

    constructor() {}

    addSettingTab() {}

    async loadData() {
        return undefined;
    }

    registerMarkdownCodeBlockProcessor(language, handler) {
        this.codeblock[language] = handler;
    }

    getCodeBlockProcessor(language) {
        return this.codeblock[language];
    }
}

class PluginSettingTab {
    constructor() {}
}

/* ----------          ---------- */

function require(target) {
    if (target === "obsidian") {
        return { Plugin, PluginSettingTab };
    } else {
        throw new Error(`unknown module: ${target}`);
    }
}
