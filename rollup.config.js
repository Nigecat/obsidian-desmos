import copy from "rollup-plugin-copy";
import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

const TEST_VAULT = "test/.obsidian/plugins/obsidian-desmos";

// eslint-disable-next-line no-undef
const isProd = process.env.BUILD === "production";

export default {
    input: "src/main.ts",
    output: {
        dir: isProd ? "." : TEST_VAULT,
        sourcemap: "inline",
        sourcemapExcludeSources: isProd,
        format: "cjs",
        exports: "default",
    },
    external: ["obsidian"],
    plugins: [
        typescript(),
        nodeResolve({ browser: true }),
        commonjs(),
        isProd
            ? null
            : copy({
                  verbose: true,
                  copyOnce: true,
                  flatten: false,
                  targets: [{ src: ["manifest.json", "versions.json", "styles.css"], dest: TEST_VAULT }],
              }),
    ],
};
