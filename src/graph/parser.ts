import Desmos from "src/main";
import { ucast, calculateHash, Hash } from "../utils";
import { EditorChange, EditorPosition, MarkdownPostProcessorContext, MarkdownView } from "obsidian";
import { GraphSettings, Equation, Color, ColorConstant, LineStyle, PointStyle, DegreeMode } from "./interface";

/** The maximum dimensions of a graph */
const MAX_SIZE = 99999;

const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
    width: 600,
    height: 400,
    left: -10,
    right: 10,
    bottom: -7,
    top: 7,
    grid: true,
    lock: false,
    live: false,
    degreeMode: DegreeMode.Radians,
};

const DEFAULT_GRAPH_WIDTH = Math.abs(DEFAULT_GRAPH_SETTINGS.left) + Math.abs(DEFAULT_GRAPH_SETTINGS.right);

const DEFAULT_GRAPH_HEIGHT = Math.abs(DEFAULT_GRAPH_SETTINGS.bottom) + Math.abs(DEFAULT_GRAPH_SETTINGS.top);

export interface UpdateContext {
    plugin: Desmos;
    target: HTMLElement;
    ctx: MarkdownPostProcessorContext;
}

export interface PotentialErrorHint {
    view: HTMLSpanElement;
}

interface ParseResult<T> {
    data: T;
    hint?: PotentialErrorHint;
}

function parseStringToEnum<V, T extends { [key: string]: V }>(obj: T, key: string): V | null {
    const objKey = Object.keys(obj).find((k) => k.toUpperCase() === key.toUpperCase());
    return objKey ? obj[objKey] : null;
}

function parseColor(value: string): Color | null {
    // If the value is a valid hex colour
    if (value.startsWith("#")) {
        // Ensure the rest of the value is a valid alphanumeric string
        if (/^[0-9a-zA-Z]+$/.test(value.slice(1))) {
            return value as Color;
        }
    }

    // If the value is a valid colour constant
    return parseStringToEnum(ColorConstant, value);
}

/** Convery a character index of the source to a line number and character position */
function chToPos(ch: number, source: string): EditorPosition | undefined {
    if (ch <= source.length) {
        const lines = source.slice(0, ch).split(/\r?\n/g);

        return { line: lines.length - 1, ch: lines[lines.length - 1].length };
    }
}

export class Graph {
    private _hash: Promise<Hash>;
    private _settings: GraphSettings;

    public readonly equations: Equation[];

    /**  Supplementary error information if the source if valid but Desmos returns an error */
    public readonly potentialErrorHint?: PotentialErrorHint;

    public get settings(): GraphSettings {
        return this._settings;
    }

    public constructor(
        equations: Equation[],
        settings: Partial<GraphSettings>,
        potentialErrorHint?: PotentialErrorHint
    ) {
        this.equations = equations;
        this.potentialErrorHint = potentialErrorHint;

        // Adjust bounds (if needed)
        Graph.adjustBounds(settings);

        // Generate hash on the raw equation and setting data,
        //  this means that if we extend the settings with new fields pre-existing graphs will have the same hash
        this._hash = calculateHash({ equations, settings });

        // Apply defaults
        this._settings = { ...DEFAULT_GRAPH_SETTINGS, ...settings };

        // Validate settings
        Graph.validateSettings(this.settings);

        // Apply color override
        if (this.settings.defaultColor) {
            this.equations = this.equations.map((equation) => ({
                color: equation.color ?? this.settings.defaultColor,
                ...equation,
            }));
        }
    }

    public static parse(source: string): Graph {
        let potentialErrorHint;
        const split = source.split("---");

        if (split.length > 2) {
            throw new SyntaxError("Too many graph segments, there can only be a singular  '---'");
        }

        // Each (non-blank) line of the equation source contains an equation,
        //  this will always be the last segment
        const equations = split[split.length - 1]
            .split(/\r?\n/g)
            .filter((equation) => equation.trim() !== "")
            .map(Graph.parseEquation)
            .map((result) => {
                if (result.hint) {
                    potentialErrorHint = result.hint;
                }
                return result.data;
            });

        // If there is more than one segment then the first one will contain the settings
        const settings = split.length > 1 ? Graph.parseSettings(split[0]) : {};

        return new Graph(equations, settings, potentialErrorHint);
    }

    public async hash(): Promise<Hash> {
        return this._hash;
    }

    public async update(updateCtx: UpdateContext, data: Partial<GraphSettings>, write = true) {
        const { ctx, plugin, target } = updateCtx;

        console.log("Performing update with data:");
        console.log(data);

        const info = ctx.getSectionInfo(target);
        const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

        if (info && editor) {
            // Extract the content of the codeblock
            const content = info.text.split(/\r?\n/g).slice(info.lineStart, info.lineEnd).join("\n");

            // The changes made to the document,
            //   these will be applied in parallel so all line numbers and character offsets should be relative to the original content
            const changes: EditorChange[] = [];

            // If there is no separator, add one
            if (!content.includes("---")) {
                changes.push({
                    text: `---\n`,
                    from: { line: info.lineStart + 1, ch: 0 },
                    to: { line: info.lineStart + 1, ch: 0 },
                });
            }

            // Attempt to insert new fields in a way which does not interfere with the existing format set by the user
            for (const [key, value] of Object.entries(data)) {
                // If this key already exists in the source, then we can just change its value
                const existing = new RegExp(String.raw`${key}\s*=\s*[^\s\n;]+\s*[\n;]`, "g").exec(content);

                // Duplicate keys are not allowed so there should always be zero or one matches
                if (existing && existing.length > 0) {
                    const existingValue = /=\s*[^\s\n;]+/g.exec(existing[0]);
                    if (existingValue && existingValue.length > 0) {
                        // Determine the length of the current value of this key
                        const existingValueLength = existingValue[0].substring(1).trim().length;

                        // Get the content after the current value (but before the separator)
                        const extra = existing[0].length - (existingValue.index + existingValue[0].length);

                        // Determine the offset of the start of the existing value from the key=value pair
                        const valueOffset = existing[0].length - existingValueLength - extra;

                        // Determine the offset of the start of the key=value pair from the start of the codeblock
                        const offset = existing.index + valueOffset;

                        // Determine the relative position of the target to the codeblock
                        const relativeStart = chToPos(offset, content);

                        if (relativeStart) {
                            // Determine the offset of the codeblock from the start of the file
                            //  (and by extension, the offset of the target value from the start of the file)
                            const start = { line: info.lineStart + relativeStart.line, ch: relativeStart.ch };
                            const end = { line: start.line, ch: start.ch + existingValueLength };

                            console.log({
                                value: value.toString(),
                                offset,
                                length: existingValueLength,
                                start,
                                end,
                            });

                            changes.push({
                                text: value.toString(),
                                from: start,
                                to: end,
                            });
                        }
                    }
                } else {
                    // If the key is not already there, then we need to insert it
                    // todo - currently we require the key to already exist
                    throw new SyntaxError("err");
                }
            }

            // Apply changes in a single transaction so ctrl+z and the like function as expected
            if (write) {
                console.log(changes);
                editor.transaction({ changes });

                // Update our internal object
                this._settings = { ...this.settings, ...data };
            }
        } else {
            console.warn("Attempted to perform graph update but failed due to invalid source location");
        }
    }

    private static validateSettings(settings: GraphSettings) {
        // Check graph is within maximum size
        if ((settings.width && settings.width > MAX_SIZE) || (settings.height && settings.height > MAX_SIZE)) {
            throw new SyntaxError(`Graph size outside of accepted bounds (must be <${MAX_SIZE}x${MAX_SIZE})`);
        }

        // Ensure boundaries are correct
        if (settings.left >= settings.right) {
            throw new SyntaxError(
                `Right boundary (${settings.right}) must be greater than left boundary (${settings.left})`
            );
        }
        if (settings.bottom >= settings.top) {
            throw new SyntaxError(`
                Top boundary (${settings.top}) must be greater than bottom boundary (${settings.bottom})
            `);
        }
    }

    private static parseEquation(eq: string): ParseResult<Equation> {
        let hint;

        const segments = eq
            .split("|")
            .map((segment) => segment.trim())
            .filter((segment) => segment !== "");

        // First segment is always the equation
        const equation: Equation = { equation: ucast(segments.shift()) };

        // The rest of the segments can either be the restriction, style, or color
        //  whilst we recommend putting the restriction first, we accept these in any order.
        for (const segment of segments) {
            const segmentUpperCase = segment.toUpperCase();

            // If this is a `hidden` tag
            if (segmentUpperCase === "HIDDEN") {
                equation.hidden = true;
                continue;
            }

            // If this is a valid style constant
            const style: LineStyle | PointStyle | null =
                parseStringToEnum(LineStyle, segmentUpperCase) ?? parseStringToEnum(PointStyle, segmentUpperCase);
            if (style) {
                if (!equation.style) {
                    equation.style = style;
                } else {
                    throw new SyntaxError(`Duplicate style identifiers detected: ${equation.style}, ${segment}`);
                }
                continue;
            }

            // If this is a valid color constant or hex code
            const color = parseColor(segment);
            if (color) {
                if (!equation.color) {
                    equation.color = color;
                } else {
                    throw new SyntaxError(
                        `Duplicate color identifiers detected, each equation may only contain a single color code.`
                    );
                }
                continue;
            }

            // If none of the above, assume it is a graph restriction
            if (segment.includes("\\")) {
                // If the restriction included a `\` (the LaTeX control character) then the user may have tried to use the LaTeX syntax in the graph restriction (e.g `\frac{1}{2}`)
                //  Desmos does not allow this but returns a fairly archaic error - "A piecewise expression must have at least one condition."
                const view = document.createElement("span");
                const pre = document.createElement("span");
                pre.innerHTML = "You may have tried to use the LaTeX syntax in the graph restriction (";
                const inner = document.createElement("code");
                inner.innerText = segment;
                const post = document.createElement("span");
                post.innerHTML =
                    "), please use some sort of an alternative (e.g <code>\\frac{1}{2}</code> => <code>1/2</code>) as this is not supported by Desmos.";
                view.appendChild(pre);
                view.appendChild(inner);
                view.appendChild(post);
                hint = { view };
            }

            if (!equation.restrictions) {
                equation.restrictions = [];
            }

            equation.restrictions.push(segment);
        }

        return { data: equation, hint };
    }

    private static parseSettings(settings: string): Partial<GraphSettings> {
        const graphSettings: Partial<GraphSettings> = {};

        // Settings may be separated by either a newline or semicolon
        settings
            .split(/[;\n]/g)
            .map((setting) => setting.trim())
            .filter((setting) => setting !== "")
            // Extract key-value pairs by splitting on the `=` in each property
            .map((setting) => setting.split("="))
            .forEach((setting) => {
                if (setting.length > 2) {
                    throw new SyntaxError(
                        `Too many segments, eaching setting must only contain a maximum of one '=' sign`
                    );
                }

                const key = setting[0].trim() as keyof GraphSettings;
                const value = setting.length > 1 ? setting[1].trim() : undefined;

                const requiresValue = () => {
                    if (value === undefined) {
                        throw new SyntaxError(`Field '${key}' must have a value`);
                    }
                };

                if (key in graphSettings) {
                    throw new SyntaxError(`Duplicate key '${key}' not allowed`);
                }

                switch (key) {
                    // Boolean fields
                    case "lock":
                    case "live":
                    case "grid": {
                        if (!value) {
                            (graphSettings[key] as boolean) = true;
                        } else {
                            const lower = value.toLowerCase();
                            if (lower !== "true" && lower !== "false") {
                                throw new SyntaxError(
                                    `Field '${key}' requres a boolean value 'true'/'false' (omit a value to default to 'true')`
                                );
                            }

                            (graphSettings[key] as boolean) = value === "true" ? true : false;
                        }
                        break;
                    }

                    // Integer fields
                    case "top":
                    case "bottom":
                    case "left":
                    case "right":
                    case "width":
                    case "height": {
                        requiresValue();
                        const num = parseFloat(value as string);
                        if (Number.isNaN(num)) {
                            throw new SyntaxError(`Field '${key}' must have an integer (or decimal) value`);
                        }
                        (graphSettings[key] as number) = num;
                        break;
                    }

                    // DegreeMode field
                    case "degreeMode": {
                        requiresValue();
                        const mode: DegreeMode | null = parseStringToEnum(DegreeMode, value as string);
                        if (mode) {
                            graphSettings.degreeMode = mode;
                        } else {
                            throw new SyntaxError(`Field 'degreeMode' must be either 'radians' or 'degrees'`);
                        }
                        break;
                    }

                    // Color field
                    case "defaultColor": {
                        requiresValue();
                        const color = parseColor(value as string);
                        if (color) {
                            graphSettings.defaultColor = color;
                        } else {
                            throw new SyntaxError(
                                `Field 'defaultColor' must be either a valid hex code or one of: ${Object.keys(
                                    ColorConstant
                                ).join(", ")}`
                            );
                        }
                        break;
                    }

                    default: {
                        throw new SyntaxError(`Unrecognised field: ${key}`);
                    }
                }
            });

        return graphSettings;
    }

    /** Dynamically adjust graph boundary if the defaults would cause an invalid graph with the settings supplied by the user,
     *  this will not do anything if the adjustment is not required.
     */
    private static adjustBounds(settings: Partial<GraphSettings>): Partial<GraphSettings> {
        if (
            settings.left !== undefined &&
            settings.right === undefined &&
            settings.left >= DEFAULT_GRAPH_SETTINGS.right
        ) {
            settings.right = settings.left + DEFAULT_GRAPH_WIDTH;
        }
        if (
            settings.left === undefined &&
            settings.right !== undefined &&
            settings.right <= DEFAULT_GRAPH_SETTINGS.left
        ) {
            settings.left = settings.right - DEFAULT_GRAPH_WIDTH;
        }
        if (
            settings.bottom !== undefined &&
            settings.top === undefined &&
            settings.bottom >= DEFAULT_GRAPH_SETTINGS.top
        ) {
            settings.top = settings.bottom + DEFAULT_GRAPH_HEIGHT;
        }
        if (
            settings.bottom === undefined &&
            settings.top !== undefined &&
            settings.top <= DEFAULT_GRAPH_SETTINGS.bottom
        ) {
            settings.bottom = settings.top - DEFAULT_GRAPH_HEIGHT;
        }

        return settings;
    }
}
