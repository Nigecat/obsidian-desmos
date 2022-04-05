import { expect } from "chai";
import { describe, it } from "mocha";
import { Dsl, EquationColor, EquationStyle } from "../src/dsl";

const parse = (source: string) => Dsl.parse(source);
const source = (args?: string[], equations?: string[]) => `
${args ? args.join("\n") : ""}
${args ? "---" : ""}
${equations ? equations.join("\n") : ""}
`;

describe("parser", () => {
    describe("equations", () => {
        it("single equation", () => {
            expect(parse(source([], ["y=x"])).equations).to.deep.equal([{ equation: "y=x" }]);
        });

        it("multiple equations", () => {
            expect(parse(source([], ["y=x", "y=2x"])).equations).to.deep.equal([
                { equation: "y=x" },
                { equation: "y=2x" },
            ]);
        });

        describe("arguments", () => {
            it("hidden", () => {
                expect(parse(source([], ["y=x|hidden"])).equations[0].hidden).to.equal(true);
            });

            describe("color", () => {
                it("hex", () => {
                    expect(parse(source([], ["y=x|#0ff"])).equations[0].color).to.equal("#0ff");
                    expect(parse(source([], ["y=x|#87ceeb"])).equations[0].color).to.equal("#87ceeb");
                });

                it("constant", () => {
                    expect(parse(source([], ["y=x|red"])).equations[0].color).to.equal(EquationColor.RED);
                    expect(parse(source([], ["y=x|green"])).equations[0].color).to.equal(EquationColor.GREEN);
                    expect(parse(source([], ["y=x|blue"])).equations[0].color).to.equal(EquationColor.BLUE);
                });
            });

            describe("style", () => {
                it("line", () => {
                    expect(parse(source([], ["y=x|solid"])).equations[0].style).to.equal(EquationStyle.Solid);
                    expect(parse(source([], ["y=x|dashed"])).equations[0].style).to.equal(EquationStyle.Dashed);
                    expect(parse(source([], ["y=x|dotted"])).equations[0].style).to.equal(EquationStyle.Dotted);
                });

                it("point", () => {
                    expect(parse(source([], ["(0,0)|point"])).equations[0].style).to.equal(EquationStyle.Point);
                    expect(parse(source([], ["(0,0)|open"])).equations[0].style).to.equal(EquationStyle.Open);
                    expect(parse(source([], ["(0,0)|cross"])).equations[0].style).to.equal(EquationStyle.Cross);
                });
            });

            describe("restrictions", () => {
                it("single restriction", () => {
                    expect(parse(source([], ["y=x|x>0"])).equations[0].restriction).to.equal("{x>0}");
                });

                it("multiple restrictionss", () => {
                    expect(parse(source([], ["y=x|x>0|y>0"])).equations[0].restriction).to.equal("{x>0}{y>0}");
                });
            });
        });
    });

    describe("arguments", () => {
        it("separator:semicolon", () => {
            let graph = parse(source(["width=800; height=600"]));
            expect(graph.fields.width).to.equal(800);
            expect(graph.fields.height).to.equal(600);

            graph = parse(source(["width=800", "height=600"]));
            expect(graph.fields.width).to.equal(800);
            expect(graph.fields.height).to.equal(600);
        });

        it("separator:newline", () => {
            const graph = parse(source(["width=500", "height=700"]));
            expect(graph.fields.width).to.equal(500);
            expect(graph.fields.height).to.equal(700);
        });

        it("separator:align", () => {
            expect(parse(source(["width=200; height=201; left=-100; right=101; bottom=-102; top=103;"]))).to.deep.equal(
                parse(source(["width=200", "height=201", "left=-100", "right=101", "bottom=-102", "top=103"]))
            );
        });

        it("dimensions:width,height", () => {
            const graph = parse(source(["width=125; height=521"]));
            expect(graph.fields.width).to.equal(125);
            expect(graph.fields.height).to.equal(521);
        });

        it("bounds:left,right,top,bottom", () => {
            const graph = parse(source(["left=-50; right=51; bottom=-54; top=26"]));
            expect(graph.fields.left).to.equal(-50);
            expect(graph.fields.right).to.equal(51);
            expect(graph.fields.bottom).to.equal(-54);
            expect(graph.fields.top).to.equal(26);
        });

        it("grid", () => {
            expect(parse(source()).fields.grid).to.equal(true);
            expect(parse(source(["grid=true"])).fields.grid).to.equal(true);
            expect(parse(source(["grid=false"])).fields.grid).to.equal(false);
        });
    });
});
