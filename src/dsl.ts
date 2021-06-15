export class Dsl {
    private constructor(
        public height: string = "400",
        public width: string = "600",
        public equations: string[] = []
    ) {}

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

        return new Dsl(settings.height, settings.width, equations);
    }
}
