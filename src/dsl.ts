/// The maximum dimensions of a graph
const MAX_SIZE = 99999;

export interface Fields {
    lock: boolean;
    width: number;
    height: number;
    left: number;
    right: number;
    bottom: number;
    top: number;
}

const FIELD_DEFAULTS: Fields = {
    lock: false,
    width: 600,
    height: 400,
    left: -10,
    right: 10,
    bottom: -7,
    top: 7,
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
        this.fields = { ...FIELD_DEFAULTS, ...fields };
        this.potentialErrorCause = potentialErrorCause;
        Dsl.assert_sanity(this.fields);
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
    private static assert_sanity(fields: Fields) {
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

    /** Ensure a string does not contain any of the banned characters (this is mostly a sanity check to prevent vulnerabilities in later interpolation) */
    private static assert_notbanned(value: string, ctx: string) {
        const bannedChars = ['"', "'", "`"];

        for (const c of bannedChars) {
            if (value.includes(c)) {
                throw new SyntaxError(`Unexpected character ${c} in ${ctx}`);
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
                        return [key, value.join("=")];
                    })
                    .reduce((settings, [k, value]) => {
                        const key = k.toLowerCase();
                        if (FIELD_DEFAULTS.hasOwnProperty(key)) {
                            // We can use the defaults to determine the type of each field
                            const fieldValue = (FIELD_DEFAULTS as any)[key];
                            const fieldType = typeof fieldValue;

                            if (fieldType !== "boolean" && !value) {
                                throw new SyntaxError(`Field '${key}' must have a value`);
                            }

                            switch (fieldType) {
                                case "number": {
                                    const s = parseInt(value, 10);
                                    if (Number.isNaN(s)) {
                                        throw new SyntaxError(`Field '${key}' must have an integer value`);
                                    }
                                    (settings as any)[key] = s;
                                    break;
                                }

                                case "boolean": {
                                    if (value) {
                                        throw new SyntaxError(`Unexpected value '${value}' for boolean key '${key}'`);
                                    }

                                    (settings as any)[key] = true;
                                    break;
                                }

                                default: {
                                    throw new SyntaxError(
                                        `Got unrecognized field type ${fieldType} with value ${fieldValue}, this is a bug.`
                                    );
                                }

                                // case "string": {
                                //     this.assert_notbanned(value, `field value for key: '${key}'`);

                                //     (settings as any)[key] = value;

                                //     break;
                                // }

                                // case "object": {
                                //     const val = JSON.parse(value);
                                //     if (
                                //         val.constructor === fieldValue.constructor
                                //     ) {
                                //         (settings as any)[key] = val;
                                //     }
                                //     break;
                                // }
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
            this.assert_notbanned(equation.equation, "graph equation");

            // The rest of the segments can either be the restriction, style, or color
            //  whilst we recommend putting the restriction first, we accept these in any order.
            for (const segment of segments) {
                const segmentUpperCase = segment.toUpperCase();

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
                    this.assert_notbanned(segment, "graph configuration");

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
