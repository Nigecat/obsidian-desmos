import { calculateHash, Hash } from "../hash";
import { GraphSettings, Equation, HexColor, ColorConstant, EquationStyle, PointStyle, DegreeMode } from "./interface";

/** The maximum dimensions of a graph */
const MAX_SIZE = 99999;

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

    private static parseSettings(settings: string): ParseResult<Partial<GraphSettings>> {
        // todo
        return { data: {} };
    }

    public static parse(source: string): Graph {
        const split = source.split("---");
        const potentialErrorHints: PotentialErrorHint[] = [];

        if (split.length > 2) {
            throw new SyntaxError("Too many graph segments"); // todo
        }

        // Each (non-blank) line of the equation source contains an equation
        const equations = split[split.length - 1]
            .split(/\r?\n/g)
            .filter((equation) => equation.trim() !== "")
            .map(Graph.parseEquation);

        const parsedSettings = split.length > 1 ? Graph.parseSettings(split[0]) : { data: {} };
        if (parsedSettings.hint) {
            potentialErrorHints.push(parsedSettings.hint);
        }
        const settings = parsedSettings.data;

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
