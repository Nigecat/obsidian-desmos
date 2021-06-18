import { createHash } from "crypto";

export interface Fields {
    width: number;
    height: number;
    boundry_left: number;
    boundry_right: number;
    boundry_bottom: number;
    boundry_top: number;
}

const FIELD_DEFAULTS: Fields = {
    width: 600,
    height: 400,
    boundry_left: -10,
    boundry_right: 10,
    boundry_bottom: -7,
    boundry_top: 7,
};

export class Dsl {
    /** A (hex) SHA-256 hash of the fields of this object  */
    public readonly hash: string;
    public readonly equations: string[];
    public readonly fields: Fields;

    private constructor(equations: string[], fields: Partial<Fields>) {
        this.equations = equations;
        this.fields = { ...FIELD_DEFAULTS, ...fields };
        Dsl.assert_sanity(this.fields);
        this.hash = createHash("sha256")
            .update(JSON.stringify(this))
            .digest("hex");
    }

    /** Check if the fields are sane, throws a `SyntaxError` if they aren't */
    private static assert_sanity(fields: Fields) {
        // Ensure boundaries are complete and in order
        if (fields.boundry_left >= fields.boundry_right) {
            throw new SyntaxError(
                `Right boundry (${fields.boundry_right}) must be greater than left boundry (${fields.boundry_left})`
            );
        }

        if (fields.boundry_bottom >= fields.boundry_top) {
            throw new SyntaxError(`
                Top boundry (${fields.boundry_top}) must be greater than bottom boundry (${fields.boundry_bottom})
            `);
        }
    }

    public static parse(source: string): Dsl {
        const split = source.split("---");

        let equations: string[];
        let fields: Partial<Fields>;
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
                                throw new SyntaxError(
                                    `Field '${key}' must have a value`
                                );
                            }

                            // We can use the defaults to determine the type of each field
                            const field_t = typeof (FIELD_DEFAULTS as any)[key];

                            switch (field_t) {
                                case "number": {
                                    const s = parseInt(value);
                                    if (Number.isNaN(s)) {
                                        throw new SyntaxError(
                                            `Field '${key}' must have an integer value`
                                        );
                                    }
                                    (settings as any)[key] = s;
                                    break;
                                }

                                case "string": {
                                    (settings as any)[key] = value;
                                    break;
                                }

                                case "object": {
                                    const arr = JSON.parse(value);
                                    if (arr.constructor === Array) {
                                        (settings as any)[key] = arr;
                                    }
                                    break;
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

        return new Dsl(equations, fields);
    }
}
