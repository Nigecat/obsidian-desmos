import { createHash } from "crypto";

export interface Fields {
    width: number;
    height: number;
    left: number;
    right: number;
    bottom: number;
    top: number;
}

const FIELD_DEFAULTS: Fields = {
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
    Red = "RED",
    Blue = "BLUE",
    Green = "GREEN",
    Purple = "PURPLE",
    Orange = "ORANGE",
    Black = "BLACK",
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
    /** A (hex) SHA-256 hash of the fields of this object  */
    public readonly hash: string;
    public readonly equations: Equation[];
    public readonly fields: Fields;

    private constructor(equations: Equation[], fields: Partial<Fields>) {
        this.equations = equations;
        this.fields = { ...FIELD_DEFAULTS, ...fields };
        Dsl.assert_sanity(this.fields);
        this.hash = createHash("sha256").update(JSON.stringify(this)).digest("hex");
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

    /** Ensure a string does not contain any of the banned characters
     *  (this is mostly a sanity check to prevent vulnerabilities in later interpolation) */
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
                    .reduce((settings, [key, value]) => {
                        if (FIELD_DEFAULTS.hasOwnProperty(key)) {
                            if (!value) {
                                throw new SyntaxError(`Field '${key}' must have a value`);
                            }

                            // We can use the defaults to determine the type of each field
                            const field_v = (FIELD_DEFAULTS as any)[key];
                            const field_t = typeof field_v;
                            switch (field_t) {
                                case "number": {
                                    const s = parseInt(value);
                                    if (Number.isNaN(s)) {
                                        throw new SyntaxError(`Field '${key}' must have an integer value`);
                                    }
                                    (settings as any)[key] = s;
                                    break;
                                }

                                case "string": {
                                    this.assert_notbanned(value, `field value for key: '${key}'`);

                                    (settings as any)[key] = value;

                                    break;
                                }

                                // case "object": {
                                //     const val = JSON.parse(value);
                                //     if (
                                //         val.constructor === field_v.constructor
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
            const segments = eq.split("|");

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
                else if (
                    Object.values(EquationColor).includes(segmentUpperCase as EquationColor) ||
                    isHexColor(segment)
                ) {
                    if (!equation.color) {
                        if (isHexColor(segment)) {
                            equation.color = segment;
                        } else {
                            equation.color = segmentUpperCase as EquationColor;
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

                    if (!equation.restriction) {
                        equation.restriction = "";
                    }

                    // Desmos allows multiple graph restrictions, so we can just concatenate
                    equation.restriction += `{${segment}}`;
                }
            }

            return equation;
        });

        // console.log(processed, fields);
        return new Dsl(processed, fields);
    }
}
