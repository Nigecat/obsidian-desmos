import { expect } from "chai";
import { describe, it } from "mocha";
import { Graph, Color, ColorConstant, LineStyle, PointStyle } from "../src/graph";

function parseGraph(data: { equation?: string; equations?: string[]; settings?: string | string[] }): Graph {
    const { equation, equations, settings } = data;

    const fieldSource = settings ? (Array.isArray(settings) ? settings.join("\n") : settings) : null;
    const equationSource = (equations ?? [equation] ?? []).join("\n");

    const source = fieldSource ? `${fieldSource}\n---\n${equationSource}` : equationSource;

    return Graph.parse(source);
}

describe("parser", () => {
    it("segments", () => {
        expect(() => Graph.parse("---\n---")).to.throw(SyntaxError);
    });

    describe("equations", () => {
        it("empty", () => {
            const graph = parseGraph({});
            expect(graph.equations).to.deep.equal([]);
        });

        it("single equation", () => {
            const graph = parseGraph({ equation: "y=x" });
            expect(graph.equations).to.deep.equal([{ equation: "y=x" }]);
        });

        it("multiple equations", () => {
            const graph = parseGraph({ equations: ["y=x", "y=2x"] });
            expect(graph.equations).to.deep.equal([{ equation: "y=x" }, { equation: "y=2x" }]);
        });

        describe("fields", () => {
            describe("color", () => {
                it("constant", () => {
                    const runConstantColorTests = (matrix: [string, Color][]) => {
                        matrix.forEach((color) => {
                            const graph = parseGraph({ equation: `y=x|${color[0]}` });
                            expect(graph.equations).to.deep.equal([{ equation: "y=x", color: color[1] }]);
                        });
                    };

                    runConstantColorTests([
                        ["red", ColorConstant.Red],
                        ["green", ColorConstant.Green],
                        ["blue", ColorConstant.Blue],
                        ["yellow", ColorConstant.Yellow],
                        ["magenta", ColorConstant.Magenta],
                        ["cyan", ColorConstant.Cyan],
                        ["purple", ColorConstant.Purple],
                        ["orange", ColorConstant.Orange],
                        ["black", ColorConstant.Black],
                        ["white", ColorConstant.White],
                    ]);
                });

                it("hex", () => {
                    const runHexColorTests = (matrix: Color[]) => {
                        matrix.forEach((color) => {
                            const graph = parseGraph({ equation: `y=x|${color}` });
                            expect(graph.equations).to.deep.equal([{ equation: "y=x", color }]);
                        });
                    };

                    runHexColorTests(["#00FFFF", "#0c9ccc", "#fff"]);
                });
            });

            it("hidden", () => {
                const graph = parseGraph({ equation: "y=x|hidden" });
                expect(graph.equations).to.deep.equal([{ equation: "y=x", hidden: true }]);
            });

            it("style", () => {
                const runStyleTests = (matrix: (PointStyle | LineStyle)[]) => {
                    matrix.forEach((style) => {
                        const graph = parseGraph({ equation: `y=x|${style}` });
                        expect(graph.equations).to.deep.equal([{ equation: "y=x", style }]);
                    });
                };

                runStyleTests([
                    PointStyle.Open,
                    PointStyle.Cross,
                    PointStyle.Point,
                    LineStyle.Solid,
                    LineStyle.Dashed,
                    LineStyle.Dotted,
                ]);
            });

            it("restrictions", () => {
                let graph = parseGraph({ equation: "y=x|0<x<5" });
                expect(graph.equations).to.deep.equal([{ equation: "y=x", restrictions: ["0<x<5"] }]);

                graph = parseGraph({ equation: String.raw`y=\sin(x)|x>0|y>0` });
                expect(graph.equations).to.deep.equal([
                    { equation: String.raw`y=\sin(x)`, restrictions: ["x>0", "y>0"] },
                ]);
            });

            it("label", () => {
                const graph = parseGraph({ equation: "y=x|label:A straight line with a gradient of 1" });
                expect(graph.equations).to.deep.equal([
                    {
                        equation: "y=x",
                        label: "A straight line with a gradient of 1",
                    },
                ]);
            });

            it("combined", () => {
                const graph = parseGraph({ equation: "x=2|y>0|dashed|green" });
                expect(graph.equations).to.deep.equal([
                    { equation: "x=2", style: LineStyle.Dashed, color: ColorConstant.Green, restrictions: ["y>0"] },
                ]);
            });
        });
    });

    describe("arguments", () => {
        describe("separator", () => {
            it("semicolon", () => {
                const graph = parseGraph({ settings: "width=800; height=600;" });
                expect(graph.settings.width).to.equal(800);
                expect(graph.settings.height).to.equal(600);
            });

            it("newline", () => {
                const graph = parseGraph({ settings: ["width=800", "height=600"] });
                expect(graph.settings.width).to.equal(800);
                expect(graph.settings.height).to.equal(600);
            });

            it("mixed", () => {
                const graph = parseGraph({ settings: ["left=0; width=800;", "height=600", "right=50"] });
                expect(graph.settings.width).to.equal(800);
                expect(graph.settings.height).to.equal(600);
                expect(graph.settings.left).to.equal(0);
                expect(graph.settings.right).to.equal(50);
            });

            it("symmetric", () => {
                // todo
            });
        });

        it("dimensions (width, height)", () => {
            // todo
        });

        it("bounds (left, right, top, bottom)", () => {
            // todo
        });

        it("grid", () => {
            // todo
        });
    });
});

describe("hash", () => {
    it("generate", async () => {
        const hash = await parseGraph({ equation: "y=x" }).hash();
        expect(hash.length).to.equal(64);
    });

    it("consistent", async () => {
        const TARGET_HASH = "21d7e41c19ea4bf443cba38f56cacbf3468eb1334d0dc0cdeb3798b8a9b36ad8";

        // Ensure hashes don't change between versions (without a good reason)
        let hash = await parseGraph({ equation: "y=x" }).hash();
        expect(hash).to.equal(TARGET_HASH);

        // Ensure hash includes headers in calculation
        hash = await parseGraph({ equation: "y=x", settings: "grid=false" }).hash();
        expect(hash).to.not.equal(TARGET_HASH);

        // Ensure hash is calculated after processing
        const hash2 = await parseGraph({ equation: "y=x    ", settings: "grid   = false" }).hash();
        expect(hash2).to.equal(hash);
    });
});
