import { calculateHash, Hash } from "../hash";
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

export interface PotentialErrorHint {
    view: HTMLSpanElement;
}

interface ParseResult<T> {
    data: T;
    hint?: PotentialErrorHint;
}

function parseStringToEnum<V, T extends { [key: string]: V }>(obj: T, key: string): ParseResult<V> | null {
    // todo
    return null;
}

function parseColor(value: string): ParseResult<ColorConstant> | ParseResult<HexColor> | null {
    // If the value is a valid hex colour
    if (value.startsWith("#")) {
        value = value.slice(1);
        // Ensure the rest of the value is a valid alphanumeric string
        if (/^[0-9a-zA-Z]+$/.test(value)) {
            return { data: value as HexColor };
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
    public readonly potentialErrorHints?: PotentialErrorHint[];

    private constructor(
        equations: Equation[],
        settings: Partial<GraphSettings>,
        potentialErrorHints?: PotentialErrorHint[]
    ) {
        this.equations = equations;
        this.potentialErrorHints = potentialErrorHints;

        // todo apply defaults
        this.settings = settings as unknown as GraphSettings;
    }

    private static parseEquation(equation: string): ParseResult<Equation> {
        // todo
        return { data: null as unknown as Equation };
    }

    private static parseSettings(settings: string): Partial<GraphSettings> {
        const graphSettings: Partial<GraphSettings> = {};

        // Settings may be separated by either a newline or semicolon
        settings
            .split(/[;\n]/g)
            .filter((setting) => setting.trim() !== "")
            // Extract key-value pairs by splitting on the `=` in each property
            .map((setting) => setting.split("="))
            .forEach((setting) => {
                if (setting.length > 2) {
                    throw new SyntaxError("Too many segments"); // todo
                }

                const key = setting[0].trim() as keyof GraphSettings;
                const value = setting.length > 1 ? settings[1].trim() : undefined;
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
                            break;
                        }
                    }
                } else {
                    throw new SyntaxError(`Unrecognised field: ${key}`);
                }
            });

        return graphSettings;
    }

    public static parse(source: string): Graph {
        const split = source.split("---");
        const potentialErrorHints: PotentialErrorHint[] = [];

        if (split.length > 2) {
            throw new SyntaxError("Too many graph segments"); // todo
        }

        // Each (non-blank) line of the equation source contains an equation,
        //  this will always be the last segment
        const equations = split[split.length - 1]
            .split(/\r?\n/g)
            .filter((equation) => equation.trim() !== "")
            .map(Graph.parseEquation)
            .map((result) => {
                if (result.hint) {
                    potentialErrorHints.push(result.hint);
                }
                return result.data;
            });

        // If there is more than one segment then the first one will contain the settings
        const settings = split.length > 1 ? Graph.parseSettings(split[0]) : {};

        return new Graph(equations, settings, potentialErrorHints);
    }

    public async hash(): Promise<Hash> {
        if (this._hash) {
            return this._hash;
        }

        // If hash not in cache then calculate it
        this._hash = await calculateHash(this);
        return this._hash;
    }
}
