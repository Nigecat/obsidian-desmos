import { expect } from "chai";
import { Dsl } from "../src/dsl";
import { describe, it } from "mocha";

const parse = (source: string) => () => Dsl.parse(source);

describe("parser", () => {
    it("single equation", () => {
        expect(parse("y=x")).to.not.throw();
    });
});
