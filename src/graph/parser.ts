import { ucast, calculateHash, Hash } from "../utils";
import { GraphSettings, Equation, HexColor, ColorConstant, LineStyle, PointStyle } from "./interface";

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
};

const DEFAULT_GRAPH_WIDTH = Math.abs(DEFAULT_GRAPH_SETTINGS.left) + Math.abs(DEFAULT_GRAPH_SETTINGS.right);

const DEFAULT_GRAPH_HEIGHT = Math.abs(DEFAULT_GRAPH_SETTINGS.bottom) + Math.abs(DEFAULT_GRAPH_SETTINGS.top);

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

function parseColor(value: string): ColorConstant | HexColor | null {
    // If the value is a valid hex colour
    if (value.startsWith("#")) {
        value = value.slice(1);
        // Ensure the rest of the value is a valid alphanumeric string
        if (/^[0-9a-zA-Z]+$/.test(value)) {
            return value as HexColor;
        }
    }

    // If the value is a valid colour constant
    return parseStringToEnum(ColorConstant, value);
}

export class Graph {
    private _hash?: Hash;

    public readonly equations: Equation[];
    public readonly settings: GraphSettings;

    /**  Supplementary error information if the source if valid but Desmos returns an error */
    public readonly potentialErrorHint?: PotentialErrorHint;

    public constructor(
        equations: Equation[],
        settings: Partial<GraphSettings>,
        potentialErrorHint?: PotentialErrorHint
    ) {
        this.equations = equations;
        this.potentialErrorHint = potentialErrorHint;

        // Adjust bounds (if needed)
        Graph.adjustBounds(settings);

        // Apply defaults
        this.settings = { ...DEFAULT_GRAPH_SETTINGS, ...settings };

        // Validate settings
        Graph.validateSettings(this.settings);
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
        if (this._hash) {
            return this._hash;
        }

        // If hash not in cache then calculate it
        this._hash = await calculateHash(this);
        return this._hash;
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
                const expectedType = typeof DEFAULT_GRAPH_SETTINGS[key];

                if (key in DEFAULT_GRAPH_SETTINGS) {
                    // Boolean fields default to `true` so do not require a value
                    if (expectedType !== "boolean" && !value) {
                        throw new SyntaxError(`Field '${key}' must have a value`);
                    }

                    switch (expectedType) {
                        case "number": {
                            const num = parseFloat(value as string);
                            if (Number.isNaN(num)) {
                                throw new SyntaxError(`Field '${key}' must have an integer (or decimal) value`);
                            }
                            (graphSettings[key] as number) = num;
                            break;
                        }

                        case "boolean": {
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

                        default: {
                            throw new SyntaxError(
                                `Got unrecognized field type ${key} with value ${value}, this is a bug.`
                            );
                        }
                    }
                } else {
                    throw new SyntaxError(`Unrecognised field: ${key}`);
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
