/// The maximum dimensions of a graph
const MAX_SIZE = 99999;

export interface Fields {
    width: number;
    height: number;
    left: number;
    right: number;
    bottom: number;
    top: number;
    grid: boolean;
}

const FIELD_DEFAULTS: Fields = {
    width: 600,
    height: 400,
    left: -10,
    right: 10,
    bottom: -7,
    top: 7,
    grid: true,
};

export interface Equation {
    equation: string;
    restriction?: string;
    style?: EquationStyle;
    color?: EquationColor | HexColor;
}

export enum EquationStyle {
    Solid = "SOLID",
    Dashed = "DASHED",
    Dotted = "DOTTED",
    Point = "POINT",
    Open = "OPEN",
    Cross = "CROSS",
}

export enum EquationColor {
    RED = "#ff0000",
    GREEN = "#00ff00",
    BLUE = "#0000ff",

    YELLOW = "#ffff00",
    MAGENTA = "#ff00ff",
    CYAN = "#00ffff",

    PURPLE = "#cc8899",
    ORANGE = "#ffa500",
    BLACK = "#000000",
    WHITE = "#ffffff",
}

export type HexColor = string;

export function isHexColor(value: string): value is HexColor {
    if (value.startsWith("#")) {
        value = value.slice(1);
        // Ensure the rest of the value is a valid alphanumeric string
        if (/^[0-9a-zA-Z]+$/.test(value)) {
            return true;
        }
    }

    return false;
}

export class Dsl {
    private _hash?: string;
    public readonly equations: Equation[];
    public readonly fields: Fields;
    /**  Supplementary error information if the source if valid but Desmos returns an error */
    public readonly potentialErrorCause?: HTMLSpanElement;

    private constructor(equations: Equation[], fields: Partial<Fields>, potentialErrorCause?: HTMLSpanElement) {
        this.equations = equations;

        // Dynamically adjust graph boundary if the defaults would cause an invalid graph with the fields supplied by the user
        // todo there should be a better way of doing this
        const defaultGraphWidth = Math.abs(FIELD_DEFAULTS.left) + Math.abs(FIELD_DEFAULTS.right);
        const defaultGraphHeight = Math.abs(FIELD_DEFAULTS.bottom) + Math.abs(FIELD_DEFAULTS.top);
        if (fields.left !== undefined && fields.right === undefined && fields.left >= FIELD_DEFAULTS.right) {
            fields.right = fields.left + defaultGraphWidth;
        }
        if (fields.left === undefined && fields.right !== undefined && fields.right <= FIELD_DEFAULTS.left) {
            fields.left = fields.right - defaultGraphWidth;
        }
        if (fields.bottom !== undefined && fields.top === undefined && fields.bottom >= FIELD_DEFAULTS.top) {
            fields.top = fields.bottom + defaultGraphHeight;
        }
        if (fields.bottom === undefined && fields.top !== undefined && fields.top <= FIELD_DEFAULTS.bottom) {
            fields.bottom = fields.top - defaultGraphHeight;
        }

        this.fields = { ...FIELD_DEFAULTS, ...fields };
        this.potentialErrorCause = potentialErrorCause;
        Dsl.assertSanity(this.fields);
    }

    /** Get a (hex) SHA-256 hash of this object */
    public async hash(): Promise<string> {
        if (this._hash) {
            return this._hash;
        }

        const data = new TextEncoder().encode(JSON.stringify(this));
        const buffer = await crypto.subtle.digest("SHA-256", data);
        const raw = Array.from(new Uint8Array(buffer));
        this._hash = raw.map((b) => b.toString(16).padStart(2, "0")).join(""); // convert binary hash to hex
        return this._hash;
    }

    /** Check if the fields are sane, throws a `SyntaxError` if they aren't */
    private static assertSanity(fields: Fields) {
        // Ensure boundaries are complete and in order
        if (fields.left >= fields.right) {
            throw new SyntaxError(
                `Right boundary (${fields.right}) must be greater than left boundary (${fields.left})`
            );
        }

        if (fields.bottom >= fields.top) {
            throw new SyntaxError(`
                Top boundary (${fields.top}) must be greater than bottom boundary (${fields.bottom})
            `);
        }
    }

    /** Assert if a string is safe to interpolate in a string wrapped by '`' (without any escaping vulnerabilities),
     *      throws a `SyntaxError` if they aren't.
     */
    private static assertSafeToInterpolate(str: string, ctx?: string) {
        if (str.includes("`")) {
            if (ctx) {
                throw new SyntaxError(`Illegal character (\`) found in ${ctx ? ctx.replace("?", str) : "string"}`);
            }
        }
    }

    public static parse(source: string): Dsl {
        const split = source.split("---");

        let potentialErrorCause: HTMLSpanElement | undefined;
        let equations: string[] | undefined;
        let fields: Partial<Fields> = {};
        switch (split.length) {
            case 0: {
                equations = [];
                break;
            }

            case 1: {
                equations = split[0].split("\n").filter(Boolean);
                break;
            }

            case 2: {
                // If there are two segments then we know the first one must contain the settings
                fields = split[0]
                    // Allow either a newline or semicolon as a delimiter
                    .split(/[;\n]+/)
                    .map((setting) => setting.trim())
                    // Remove any empty elements
                    .filter(Boolean)
                    // Split each field on the first equals sign to create the key=value pair
                    .map((setting) => {
                        const [key, ...value] = setting.split("=");
                        // Trim each field, this allows the user to put spaces around the key of a value if they wish
                        return [key.trim(), value.join("=").trim()];
                    })
                    .reduce((settings, [k, value]) => {
                        const key = k.toLowerCase() as keyof Fields;
                        if (key in FIELD_DEFAULTS) {
                            // We can use the defaults to determine the type of each field
                            const fieldValue = FIELD_DEFAULTS[key];
                            const fieldType = typeof fieldValue;

                            // Sanity check
                            Dsl.assertSafeToInterpolate(value, `field '${key}': ?`);

                            // Boolean fields default to `true`
                            if (fieldType !== "boolean" && !value) {
                                throw new SyntaxError(`Field '${key}' must have a value`);
                            }

                            switch (fieldType) {
                                case "number": {
                                    const s = parseFloat(value);
                                    if (Number.isNaN(s)) {
                                        throw new SyntaxError(`Field '${key}' must have an integer value`);
                                    }
                                    (settings[key] as number) = s;
                                    break;
                                }

                                case "boolean": {
                                    if (!value) {
                                        (settings[key] as boolean) = true;
                                    } else {
                                        if (!["true", "false"].includes(value.toLowerCase())) {
                                            throw new SyntaxError(
                                                `Field '${key}' requres a boolean value 'true'/'false' (omit a value to default to 'true')`
                                            );
                                        }

                                        (settings[key] as boolean) = value.toLowerCase() === "true" ? true : false;
                                    }
                                    break;
                                }

                                default: {
                                    throw new SyntaxError(
                                        `Got unrecognized field type ${fieldType} with value ${fieldValue}, this is a bug.`
                                    );
                                }
                            }
                        } else {
                            throw new SyntaxError(`Unrecognised field: ${key}`);
                        }

                        return settings;
                    }, {} as Partial<Fields>);

                equations = split[1].split("\n").filter(Boolean);
                break;
            }

            default: {
                fields = {};
            }
        }
        if (!equations) {
            throw new SyntaxError("Too many segments");
        }

        // Process equations
        const processed = equations.map((eq) => {
            const segments = eq.split("|").map((segment) => segment.trim());

            // First segment is always the equation
            const equation: Equation = { equation: segments.shift() as unknown as string };

            // Sanity check
            Dsl.assertSafeToInterpolate(equation.equation, `equation: ?`);

            // The rest of the segments can either be the restriction, style, or color
            //  whilst we recommend putting the restriction first, we accept these in any order.
            for (const segment of segments) {
                const segmentUpperCase = segment.toUpperCase();

                // Sanity check
                Dsl.assertSafeToInterpolate(segment, `segment: ?`);

                // If this is a valid style constant
                if (Object.values(EquationStyle).includes(segmentUpperCase as EquationStyle)) {
                    if (!equation.style) {
                        equation.style = segmentUpperCase as EquationStyle;
                    } else {
                        throw new SyntaxError(
                            `Duplicate style identifiers detected: ${equation.style}, ${segmentUpperCase}`
                        );
                    }
                }

                // If this is a valid color constant or hex code
                else if (Object.keys(EquationColor).includes(segmentUpperCase) || isHexColor(segment)) {
                    if (!equation.color) {
                        if (isHexColor(segment)) {
                            equation.color = segment;
                        } else {
                            equation.color =
                                Object.values(EquationColor)[Object.keys(EquationColor).indexOf(segmentUpperCase)];
                        }
                    } else {
                        throw new SyntaxError(
                            `Duplicate color identifiers detected: ${equation.color}, ${segmentUpperCase}`
                        );
                    }
                }

                // Otherwise, assume it is a graph restriction
                else {
                    if ((segment as string).includes("\\")) {
                        // If the restriction included a `\` (the LaTeX control character) then the user may have tried to use the LaTeX syntax in the graph restriction (e.g `\frac{1}{2}`)
                        //  Desmos does not allow this but returns a fairly archaic error - "A piecewise expression must have at least one condition."
                        potentialErrorCause = document.createElement("span");

                        const pre = document.createElement("span");
                        pre.innerHTML = "You may have tried to use the LaTeX syntax in the graph restriction (";

                        const inner = document.createElement("code");
                        inner.innerText = segment;

                        const post = document.createElement("span");
                        post.innerHTML =
                            "), please use some sort of an alternative (e.g <code>\\frac{1}{2}</code> => <code>1/2</code>) as this is not supported by Desmos.";

                        potentialErrorCause.appendChild(pre);
                        potentialErrorCause.appendChild(inner);
                        potentialErrorCause.appendChild(post);
                    }

                    if (!equation.restriction) {
                        equation.restriction = "";
                    }

                    // Desmos allows multiple graph restrictions, so we can just concatenate
                    equation.restriction += `{${segment}}`;
                }
            }

            return equation;
        });

        // Limit the height and width to something reasonable
        if (Math.max(fields.width ?? 0, fields.height ?? 0) > MAX_SIZE) {
            throw new SyntaxError(`Graph size outside of accepted bounds (${MAX_SIZE}x${MAX_SIZE})`);
        }

        return new Dsl(processed, fields, potentialErrorCause);
    }
}
