import { createHash } from "crypto";

export class Dsl {
    /// A (hex) SHA-256 hash of the fields of this object
    public hash: string;

    private constructor(
        public readonly equations: string[] = [],
        public readonly width: number = 600,
        public readonly height: number = 400,
        public readonly boundry_left = -10,
        public readonly boundry_right = 10,
        public readonly boundry_bottom = -7,
        public readonly boundry_top = 7
    ) {
        this.hash = createHash("sha256")
            .update(
                equations
                    .join(",")
                    .concat(
                        width.toString(),
                        height.toString(),
                        boundry_left.toString(),
                        boundry_right.toString(),
                        boundry_bottom.toString(),
                        boundry_top.toString()
                    )
            )
            .digest("hex");
    }

    static parse(source: string): Dsl {
        const split = source.split("---");

        // Welcome to ternary hell, have a nice stay
        const equations =
            split.length == 0
                ? []
                : split.length == 1
                ? split[0].split("\n").filter(Boolean)
                : split.length == 2
                ? split[1].split("\n").filter(Boolean)
                : null;

        if (equations == null) {
            throw new SyntaxError("Too many segments");
        }

        const settings =
            split.length == 2
                ? split[0]
                      .split(";")
                      .map((setting) => setting.trim())
                      .filter(Boolean) // remove any empty elements
                      .map((setting) => setting.split("=").map((e) => e.trim()))
                      .reduce((settings, setting) => {
                          settings[setting[0]] = setting[1];
                          return settings;
                      }, {} as Record<string, string>)
                : {};

        // Ensure boundaries are complete
        // (basically ensure if we have one value then we also have the other)
        if (!!settings.boundry_left == !settings.boundry_right) {
            throw new SyntaxError(
                "Incomplete boundaries: If you specify one boundry you must also specify the other (boundry_left, boundry_right"
            );
        }
        if (!!settings.boundry_bottom == !settings.boundry_top) {
            throw new SyntaxError(
                "Incomplete boundaries: If you specify one boundry you must also specify the other (boundry_bottom, boundry_top"
            );
        }

        return new Dsl(
            equations,
            parseInt(settings.width) || undefined,
            parseInt(settings.height) || undefined,
            parseInt(settings.boundry_left) || undefined,
            parseInt(settings.boundry_right) || undefined,
            parseInt(settings.boundry_top) || undefined,
            parseInt(settings.boundry_bottom) || undefined
        );
    }
}
