import { __awaiter } from "tslib";
import { ucast, calculateHash } from "../utils";
import { ColorConstant, LineStyle, PointStyle, DegreeMode } from "./interface";
/** The maximum dimensions of a graph */
const MAX_SIZE = 99999;
const DEFAULT_GRAPH_SETTINGS = {
    width: 600,
    height: 400,
    left: -10,
    right: 10,
    bottom: -7,
    top: 7,
    grid: true,
    degreeMode: DegreeMode.Radians,
    hideAxisNumbers: false,
};
const DEFAULT_GRAPH_WIDTH = Math.abs(DEFAULT_GRAPH_SETTINGS.left) + Math.abs(DEFAULT_GRAPH_SETTINGS.right);
const DEFAULT_GRAPH_HEIGHT = Math.abs(DEFAULT_GRAPH_SETTINGS.bottom) + Math.abs(DEFAULT_GRAPH_SETTINGS.top);
function parseStringToEnum(obj, key) {
    const objKey = Object.keys(obj).find((k) => k.toUpperCase() === key.toUpperCase());
    return objKey ? obj[objKey] : null;
}
function parseColor(value) {
    // If the value is a valid hex colour
    if (value.startsWith("#")) {
        // Ensure the rest of the value is a valid alphanumeric string
        if (/^[0-9a-zA-Z]+$/.test(value.slice(1))) {
            return value;
        }
    }
    // If the value is a valid colour constant
    return parseStringToEnum(ColorConstant, value);
}
export class Graph {
    constructor(equations, settings, potentialErrorHint) {
        this.equations = equations;
        this.potentialErrorHint = potentialErrorHint;
        // Adjust bounds (if needed)
        Graph.adjustBounds(settings);
        // Generate hash on the raw equation and setting data,
        //  this means that if we extend the settings with new fields pre-existing graphs will have the same hash
        this._hash = calculateHash({ equations, settings });
        // Apply defaults
        this.settings = Object.assign(Object.assign({}, DEFAULT_GRAPH_SETTINGS), settings);
        // Validate settings
        Graph.validateSettings(this.settings);
        // Apply color override
        if (this.settings.defaultColor) {
            this.equations = this.equations.map((equation) => {
                var _a;
                return (Object.assign({ color: (_a = equation.color) !== null && _a !== void 0 ? _a : this.settings.defaultColor }, equation));
            });
        }
    }
    static parse(source) {
        let potentialErrorHint;
        const split = source.split("---");
        if (split.length > 2) {
            throw new SyntaxError("Too many graph segments, there can only be a singular  '---'");
        }
        // Each (non-blank) line of the equation source contains an equation,
        //  this will always be the last segment
        const equations = split[split.length - 1]
            .split(/\r?\n/g)
            .filter((equation) => equation.trim() !== "")
            .map(Graph.parseEquation)
            .map((result) => {
            if (result.hint) {
                potentialErrorHint = result.hint;
            }
            return result.data;
        });
        // If there is more than one segment then the first one will contain the settings
        const settings = split.length > 1 ? Graph.parseSettings(split[0]) : {};
        return new Graph(equations, settings, potentialErrorHint);
    }
    hash() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._hash;
        });
    }
    static validateSettings(settings) {
        // Check graph is within maximum size
        if ((settings.width && settings.width > MAX_SIZE) || (settings.height && settings.height > MAX_SIZE)) {
            throw new SyntaxError(`Graph size outside of accepted bounds (must be <${MAX_SIZE}x${MAX_SIZE})`);
        }
        // Ensure boundaries are correct
        if (settings.left >= settings.right) {
            throw new SyntaxError(`Right boundary (${settings.right}) must be greater than left boundary (${settings.left})`);
        }
        if (settings.bottom >= settings.top) {
            throw new SyntaxError(`
                Top boundary (${settings.top}) must be greater than bottom boundary (${settings.bottom})
            `);
        }
    }
    static parseEquation(eq) {
        var _a;
        let hint;
        const segments = eq
            .split("|")
            .map((segment) => segment.trim())
            .filter((segment) => segment !== "");
        // First segment is always the equation
        const equation = { equation: ucast(segments.shift()) };
        // The rest of the segments can either be the restriction, style, or color
        //  whilst we recommend putting the restriction first, we accept these in any order.
        for (const segment of segments) {
            const segmentUpperCase = segment.toUpperCase();
            // If this is a `hidden` tag
            if (segmentUpperCase === "HIDDEN") {
                equation.hidden = true;
                continue;
            }
            // If this is a valid style constant
            const style = (_a = parseStringToEnum(LineStyle, segmentUpperCase)) !== null && _a !== void 0 ? _a : parseStringToEnum(PointStyle, segmentUpperCase);
            if (style) {
                if (!equation.style) {
                    equation.style = style;
                }
                else {
                    throw new SyntaxError(`Duplicate style identifiers detected: ${equation.style}, ${segment}`);
                }
                continue;
            }
            // If this is a valid color constant or hex code
            const color = parseColor(segment);
            if (color) {
                if (!equation.color) {
                    equation.color = color;
                }
                else {
                    throw new SyntaxError(`Duplicate color identifiers detected, each equation may only contain a single color code.`);
                }
                continue;
            }
            // If this is a valid label string
            if (segmentUpperCase.startsWith("LABEL:")) {
                const label = segment.split(":").slice(1).join(":").trim();
                if (equation.label === undefined) {
                    if (label === "") {
                        throw new SyntaxError(`Equation label must have a value`);
                    }
                    else {
                        equation.label = label;
                    }
                }
                else {
                    throw new SyntaxError(`Duplicate equation labels detected, each equation may only contain a single label.`);
                }
                continue;
            }
            // If this is a valid defult label string
            if (segmentUpperCase === "LABEL") {
                // If we pass an empty string as the label,
                //  Desmos will use the source equation of the point as the label
                equation.label = "";
                continue;
            }
            // If none of the above, assume it is a graph restriction
            if (segment.includes("\\")) {
                // If the restriction included a `\` (the LaTeX control character) then the user may have tried to use the LaTeX syntax in the graph restriction (e.g `\frac{1}{2}`)
                //  Desmos does not allow this but returns a fairly archaic error - "A piecewise expression must have at least one condition."
                const view = document.createElement("span");
                const pre = document.createElement("span");
                pre.innerHTML = "You may have tried to use the LaTeX syntax in the graph restriction (";
                const inner = document.createElement("code");
                inner.innerText = segment;
                const post = document.createElement("span");
                post.innerHTML =
                    "), please use some sort of an alternative (e.g <code>\\frac{1}{2}</code> => <code>1/2</code>) as this is not supported by Desmos.";
                view.appendChild(pre);
                view.appendChild(inner);
                view.appendChild(post);
                hint = { view };
            }
            if (!equation.restrictions) {
                equation.restrictions = [];
            }
            equation.restrictions.push(segment);
        }
        return { data: equation, hint };
    }
    static parseSettings(settings) {
        const graphSettings = {};
        // Settings may be separated by either a newline or semicolon
        settings
            .split(/[;\n]/g)
            .map((setting) => setting.trim())
            .filter((setting) => setting !== "")
            // Extract key-value pairs by splitting on the `=` in each property
            .map((setting) => setting.split("="))
            .forEach((setting) => {
            if (setting.length > 2) {
                throw new SyntaxError(`Too many segments, eaching setting must only contain a maximum of one '=' sign`);
            }
            const key = setting[0].trim();
            const value = setting.length > 1 ? setting[1].trim() : undefined;
            // Prevent duplicate keys
            if (key in graphSettings) {
                throw new SyntaxError(`Duplicate key '${key}' not allowed`);
            }
            const requiresValue = () => {
                if (value === undefined) {
                    throw new SyntaxError(`Field '${key}' must have a value`);
                }
            };
            switch (key) {
                // Boolean fields
                case "hideAxisNumbers":
                case "grid": {
                    if (!value) {
                        graphSettings[key] = true;
                    }
                    else {
                        const lower = value.toLowerCase();
                        if (lower !== "true" && lower !== "false") {
                            throw new SyntaxError(`Field '${key}' requres a boolean value 'true'/'false' (omit a value to default to 'true')`);
                        }
                        graphSettings[key] = value === "true" ? true : false;
                    }
                    break;
                }
                // Integer fields
                case "top":
                case "bottom":
                case "left":
                case "right":
                case "width":
                case "height": {
                    requiresValue();
                    const num = parseFloat(value);
                    if (Number.isNaN(num)) {
                        throw new SyntaxError(`Field '${key}' must have an integer (or decimal) value`);
                    }
                    graphSettings[key] = num;
                    break;
                }
                // DegreeMode field
                case "degreeMode": {
                    requiresValue();
                    const mode = parseStringToEnum(DegreeMode, value);
                    if (mode) {
                        graphSettings.degreeMode = mode;
                    }
                    else {
                        throw new SyntaxError(`Field 'degreeMode' must be either 'radians' or 'degrees'`);
                    }
                    break;
                }
                // Color field
                case "defaultColor": {
                    requiresValue();
                    const color = parseColor(value);
                    if (color) {
                        graphSettings.defaultColor = color;
                    }
                    else {
                        throw new SyntaxError(`Field 'defaultColor' must be either a valid hex code or one of: ${Object.keys(ColorConstant).join(", ")}`);
                    }
                    break;
                }
                default: {
                    throw new SyntaxError(`Unrecognised field: ${key}`);
                }
            }
        });
        return graphSettings;
    }
    /** Dynamically adjust graph boundary if the defaults would cause an invalid graph with the settings supplied by the user,
     *  this will not do anything if the adjustment is not required.
     */
    static adjustBounds(settings) {
        if (settings.left !== undefined &&
            settings.right === undefined &&
            settings.left >= DEFAULT_GRAPH_SETTINGS.right) {
            settings.right = settings.left + DEFAULT_GRAPH_WIDTH;
        }
        if (settings.left === undefined &&
            settings.right !== undefined &&
            settings.right <= DEFAULT_GRAPH_SETTINGS.left) {
            settings.left = settings.right - DEFAULT_GRAPH_WIDTH;
        }
        if (settings.bottom !== undefined &&
            settings.top === undefined &&
            settings.bottom >= DEFAULT_GRAPH_SETTINGS.top) {
            settings.top = settings.bottom + DEFAULT_GRAPH_HEIGHT;
        }
        if (settings.bottom === undefined &&
            settings.top !== undefined &&
            settings.top <= DEFAULT_GRAPH_SETTINGS.bottom) {
            settings.bottom = settings.top - DEFAULT_GRAPH_HEIGHT;
        }
        return settings;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGFyc2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxPQUFPLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBUSxNQUFNLFVBQVUsQ0FBQztBQUN0RCxPQUFPLEVBQWtDLGFBQWEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUUvRyx3Q0FBd0M7QUFDeEMsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDO0FBRXZCLE1BQU0sc0JBQXNCLEdBQWtCO0lBQzFDLEtBQUssRUFBRSxHQUFHO0lBQ1YsTUFBTSxFQUFFLEdBQUc7SUFDWCxJQUFJLEVBQUUsQ0FBQyxFQUFFO0lBQ1QsS0FBSyxFQUFFLEVBQUU7SUFDVCxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ1YsR0FBRyxFQUFFLENBQUM7SUFDTixJQUFJLEVBQUUsSUFBSTtJQUNWLFVBQVUsRUFBRSxVQUFVLENBQUMsT0FBTztJQUM5QixlQUFlLEVBQUUsS0FBSztDQUN6QixDQUFDO0FBRUYsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLENBQUM7QUFFM0csTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLENBQUM7QUFXNUcsU0FBUyxpQkFBaUIsQ0FBb0MsR0FBTSxFQUFFLEdBQVc7SUFDN0UsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsS0FBSyxHQUFHLENBQUMsV0FB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Q0oiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB1Y2FzdCwgY2FsY3VsYXRlSGFzaCwgSGFzaCB9IGZyb20gXCIuLi91dGlsc1wiO1xuaW1wb3J0IHsgR3JhcGhTZXR0aW5ncywgRXF1YXRpb24sIENvbG9yLCBDb2xvckNvbnN0YW50LCBMaW5lU3R5bGUsIFBvaW50U3R5bGUsIERlZ3JlZU1vZGUgfSBmcm9tIFwiLi9pbnRlcmZhY2VcIjtcblxuLyoqIFRoZSBtYXhpbXVtIGRpbWVuc2lvbnMgb2YgYSBncmFwaCAqL1xuY29uc3QgTUFYX1NJWkUgPSA5OTk5OTtcblxuY29uc3QgREVGQVVMVF9HUkFQSF9TRVRUSU5HUzogR3JhcGhTZXR0aW5ncyA9IHtcbiAgICB3aWR0aDogNjAwLFxuICAgIGhlaWdodDogNDAwLFxuICAgIGxlZnQ6IC0xMCxcbiAgICByaWdodDogMTAsXG4gICAgYm90dG9tOiAtNyxcbiAgICB0b3A6IDcsXG4gICAgZ3JpZDogdHJ1ZSxcbiAgICBkZWdyZWVNb2RlOiBEZWdyZWVNb2RlLlJhZGlhbnMsXG4gICAgaGlkZUF4aXNOdW1iZXJzOiBmYWxzZSxcbn07XG5cbmNvbnN0IERFRkFVTFRfR1JBUEhfV0lEVEggPSBNYXRoLmFicyhERUZBVUxUX0dSQVBIX1NFVFRJTkdTLmxlZnQpICsgTWF0aC5hYnMoREVGQVVMVF9HUkFQSF9TRVRUSU5HUy5yaWdodCk7XG5cbmNvbnN0IERFRkFVTFRfR1JBUEhfSEVJR0hUID0gTWF0aC5hYnMoREVGQVVMVF9HUkFQSF9TRVRUSU5HUy5ib3R0b20pICsgTWF0aC5hYnMoREVGQVVMVF9HUkFQSF9TRVRUSU5HUy50b3ApO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBvdGVudGlhbEVycm9ySGludCB7XG4gICAgdmlldzogSFRNTFNwYW5FbGVtZW50O1xufVxuXG5pbnRlcmZhY2UgUGFyc2VSZXN1bHQ8VD4ge1xuICAgIGRhdGE6IFQ7XG4gICAgaGludD86IFBvdGVudGlhbEVycm9ySGludDtcbn1cblxuZnVuY3Rpb24gcGFyc2VTdHJpbmdUb0VudW08ViwgVCBleHRlbmRzIHsgW2tleTogc3RyaW5nXTogViB9PihvYmo6IFQsIGtleTogc3RyaW5nKTogViB8IG51bGwge1xuICAgIGNvbnN0IG9iaktleSA9IE9iamVjdC5rZXlzKG9iaikuZmluZCgoaykgPT4gay50b1VwcGVyQ2FzZSgpID09PSBrZXkudG9VcHBlckNhc2UoKSk7XG4gICAgcmV0dXJuIG9iaktleSA/IG9ialtvYmpLZXldIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gcGFyc2VDb2xvcih2YWx1ZTogc3RyaW5nKTogQ29sb3IgfCBudWxsIHtcbiAgICAvLyBJZiB0aGUgdmFsdWUgaXMgYSB2YWxpZCBoZXggY29sb3VyXG4gICAgaWYgKHZhbHVlLnN0YXJ0c1dpdGgoXCIjXCIpKSB7XG4gICAgICAgIC8vIEVuc3VyZSB0aGUgcmVzdCBvZiB0aGUgdmFsdWUgaXMgYSB2YWxpZCBhbHBoYW51bWVyaWMgc3RyaW5nXG4gICAgICAgIGlmICgvXlswLTlhLXpBLVpdKyQvLnRlc3QodmFsdWUuc2xpY2UoMSkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUgYXMgQ29sb3I7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgdmFsdWUgaXMgYSB2YWxpZCBjb2xvdXIgY29uc3RhbnRcbiAgICByZXR1cm4gcGFyc2VTdHJpbmdUb0VudW0oQ29sb3JDb25zdGFudCwgdmFsdWUpO1xufVxuXG5leHBvcnQgY2xhc3MgR3JhcGgge1xuICAgIHByaXZhdGUgX2hhc2g6IFByb21pc2U8SGFzaD47XG5cbiAgICBwdWJsaWMgcmVhZG9ubHkgZXF1YXRpb25zOiBFcXVhdGlvbltdO1xuICAgIHB1YmxpYyByZWFkb25seSBzZXR0aW5nczogR3JhcGhTZXR0aW5ncztcblxuICAgIC8qKiAgU3VwcGxlbWVudGFyeSBlcnJvciBpbmZvcm1hdGlvbiBpZiB0aGUgc291cmNlIGlmIHZhbGlkIGJ1dCBEZXNtb3MgcmV0dXJucyBhbiBlcnJvciAqL1xuICAgIHB1YmxpYyByZWFkb25seSBwb3RlbnRpYWxFcnJvckhpbnQ/OiBQb3RlbnRpYWxFcnJvckhpbnQ7XG5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgIGVxdWF0aW9uczogRXF1YXRpb25bXSxcbiAgICAgICAgc2V0dGluZ3M6IFBhcnRpYWw8R3JhcGhTZXR0aW5ncz4sXG4gICAgICAgIHBvdGVudGlhbEVycm9ySGludD86IFBvdGVudGlhbEVycm9ySGludFxuICAgICkge1xuICAgICAgICB0aGlzLmVxdWF0aW9ucyA9IGVxdWF0aW9ucztcbiAgICAgICAgdGhpcy5wb3RlbnRpYWxFcnJvckhpbnQgPSBwb3RlbnRpYWxFcnJvckhpbnQ7XG5cbiAgICAgICAgLy8gQWRqdXN0IGJvdW5kcyAoaWYgbmVlZGVkKVxuICAgICAgICBHcmFwaC5hZGp1c3RCb3VuZHMoc2V0dGluZ3MpO1xuXG4gICAgICAgIC8vIEdlbmVyYXRlIGhhc2ggb24gdGhlIHJhdyBlcXVhdGlvbiBhbmQgc2V0dGluZyBkYXRhLFxuICAgICAgICAvLyAgdGhpcyBtZWFucyB0aGF0IGlmIHdlIGV4dGVuZCB0aGUgc2V0dGluZ3Mgd2l0aCBuZXcgZmllbGRzIHByZS1leGlzdGluZyBncmFwaHMgd2lsbCBoYXZlIHRoZSBzYW1lIGhhc2hcbiAgICAgICAgdGhpcy5faGFzaCA9IGNhbGN1bGF0ZUhhc2goeyBlcXVhdGlvbnMsIHNldHRpbmdzIH0pO1xuXG4gICAgICAgIC8vIEFwcGx5IGRlZmF1bHRzXG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfR1JBUEhfU0VUVElOR1MsIC4uLnNldHRpbmdzIH07XG5cbiAgICAgICAgLy8gVmFsaWRhdGUgc2V0dGluZ3NcbiAgICAgICAgR3JhcGgudmFsaWRhdGVTZXR0aW5ncyh0aGlzLnNldHRpbmdzKTtcblxuICAgICAgICAvLyBBcHBseSBjb2xvciBvdmVycmlkZVxuICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy5kZWZhdWx0Q29sb3IpIHtcbiAgICAgICAgICAgIHRoaXMuZXF1YXRpb25zID0gdGhpcy5lcXVhdGlvbnMubWFwKChlcXVhdGlvbikgPT4gKHtcbiAgICAgICAgICAgICAgICBjb2xvcjogZXF1YXRpb24uY29sb3IgPz8gdGhpcy5zZXR0aW5ncy5kZWZhdWx0Q29sb3IsXG4gICAgICAgICAgICAgICAgLi4uZXF1YXRpb24sXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIHBhcnNlKHNvdXJjZTogc3RyaW5nKTogR3JhcGgge1xuICAgICAgICBsZXQgcG90ZW50aWFsRXJyb3JIaW50O1xuICAgICAgICBjb25zdCBzcGxpdCA9IHNvdXJjZS5zcGxpdChcIi0tLVwiKTtcblxuICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiVG9vIG1hbnkgZ3JhcGggc2VnbWVudHMsIHRoZXJlIGNhbiBvbmx5IGJlIGEgc2luZ3VsYXIgICctLS0nXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRWFjaCAobm9uLWJsYW5rKSBsaW5lIG9mIHRoZSBlcXVhdGlvbiBzb3VyY2UgY29udGFpbnMgYW4gZXF1YXRpb24sXG4gICAgICAgIC8vICB0aGlzIHdpbGwgYWx3YXlzIGJlIHRoZSBsYXN0IHNlZ21lbnRcbiAgICAgICAgY29uc3QgZXF1YXRpb25zID0gc3BsaXRbc3BsaXQubGVuZ3RoIC0gMV1cbiAgICAgICAgICAgIC5zcGxpdCgvXFxyP1xcbi9nKVxuICAgICAgICAgICAgLmZpbHRlcigoZXF1YXRpb24pID0+IGVxdWF0aW9uLnRyaW0oKSAhPT0gXCJcIilcbiAgICAgICAgICAgIC5tYXAoR3JhcGgucGFyc2VFcXVhdGlvbilcbiAgICAgICAgICAgIC5tYXAoKHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuaGludCkge1xuICAgICAgICAgICAgICAgICAgICBwb3RlbnRpYWxFcnJvckhpbnQgPSByZXN1bHQuaGludDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5kYXRhO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gSWYgdGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBzZWdtZW50IHRoZW4gdGhlIGZpcnN0IG9uZSB3aWxsIGNvbnRhaW4gdGhlIHNldHRpbmdzXG4gICAgICAgIGNvbnN0IHNldHRpbmdzID0gc3BsaXQubGVuZ3RoID4gMSA/IEdyYXBoLnBhcnNlU2V0dGluZ3Moc3BsaXRbMF0pIDoge307XG5cbiAgICAgICAgcmV0dXJuIG5ldyBHcmFwaChlcXVhdGlvbnMsIHNldHRpbmdzLCBwb3RlbnRpYWxFcnJvckhpbnQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBoYXNoKCk6IFByb21pc2U8SGFzaD4ge1xuICAgICAgICByZXR1cm4gdGhpcy5faGFzaDtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRpYyB2YWxpZGF0ZVNldHRpbmdzKHNldHRpbmdzOiBHcmFwaFNldHRpbmdzKSB7XG4gICAgICAgIC8vIENoZWNrIGdyYXBoIGlzIHdpdGhpbiBtYXhpbXVtIHNpemVcbiAgICAgICAgaWYgKChzZXR0aW5ncy53aWR0aCAmJiBzZXR0aW5ncy53aWR0aCA+IE1BWF9TSVpFKSB8fCAoc2V0dGluZ3MuaGVpZ2h0ICYmIHNldHRpbmdzLmhlaWdodCA+IE1BWF9TSVpFKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBHcmFwaCBzaXplIG91dHNpZGUgb2YgYWNjZXB0ZWQgYm91bmRzIChtdXN0IGJlIDwke01BWF9TSVpFfXgke01BWF9TSVpFfSlgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEVuc3VyZSBib3VuZGFyaWVzIGFyZSBjb3JyZWN0XG4gICAgICAgIGlmIChzZXR0aW5ncy5sZWZ0ID49IHNldHRpbmdzLnJpZ2h0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgICAgYFJpZ2h0IGJvdW5kYXJ5ICgke3NldHRpbmdzLnJpZ2h0fSkgbXVzdCBiZSBncmVhdGVyIHRoYW4gbGVmdCBib3VuZGFyeSAoJHtzZXR0aW5ncy5sZWZ0fSlgXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzZXR0aW5ncy5ib3R0b20gPj0gc2V0dGluZ3MudG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFxuICAgICAgICAgICAgICAgIFRvcCBib3VuZGFyeSAoJHtzZXR0aW5ncy50b3B9KSBtdXN0IGJlIGdyZWF0ZXIgdGhhbiBib3R0b20gYm91bmRhcnkgKCR7c2V0dGluZ3MuYm90dG9tfSlcbiAgICAgICAgICAgIGApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0aWMgcGFyc2VFcXVhdGlvbihlcTogc3RyaW5nKTogUGFyc2VSZXN1bHQ8RXF1YXRpb24+IHtcbiAgICAgICAgbGV0IGhpbnQ7XG5cbiAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBlcVxuICAgICAgICAgICAgLnNwbGl0KFwifFwiKVxuICAgICAgICAgICAgLm1hcCgoc2VnbWVudCkgPT4gc2VnbWVudC50cmltKCkpXG4gICAgICAgICAgICAuZmlsdGVyKChzZWdtZW50KSA9PiBzZWdtZW50ICE9PSBcIlwiKTtcblxuICAgICAgICAvLyBGaXJzdCBzZWdtZW50IGlzIGFsd2F5cyB0aGUgZXF1YXRpb25cbiAgICAgICAgY29uc3QgZXF1YXRpb246IEVxdWF0aW9uID0geyBlcXVhdGlvbjogdWNhc3Qoc2VnbWVudHMuc2hpZnQoKSkgfTtcblxuICAgICAgICAvLyBUaGUgcmVzdCBvZiB0aGUgc2VnbWVudHMgY2FuIGVpdGhlciBiZSB0aGUgcmVzdHJpY3Rpb24sIHN0eWxlLCBvciBjb2xvclxuICAgICAgICAvLyAgd2hpbHN0IHdlIHJlY29tbWVuZCBwdXR0aW5nIHRoZSByZXN0cmljdGlvbiBmaXJzdCwgd2UgYWNjZXB0IHRoZXNlIGluIGFueSBvcmRlci5cbiAgICAgICAgZm9yIChjb25zdCBzZWdtZW50IG9mIHNlZ21lbnRzKSB7XG4gICAgICAgICAgICBjb25zdCBzZWdtZW50VXBwZXJDYXNlID0gc2VnbWVudC50b1VwcGVyQ2FzZSgpO1xuXG4gICAgICAgICAgICAvLyBJZiB0aGlzIGlzIGEgYGhpZGRlbmAgdGFnXG4gICAgICAgICAgICBpZiAoc2VnbWVudFVwcGVyQ2FzZSA9PT0gXCJISURERU5cIikge1xuICAgICAgICAgICAgICAgIGVxdWF0aW9uLmhpZGRlbiA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHRoaXMgaXMgYSB2YWxpZCBzdHlsZSBjb25zdGFudFxuICAgICAgICAgICAgY29uc3Qgc3R5bGU6IExpbmVTdHlsZSB8IFBvaW50U3R5bGUgfCBudWxsID1cbiAgICAgICAgICAgICAgICBwYXJzZVN0cmluZ1RvRW51bShMaW5lU3R5bGUsIHNlZ21lbnRVcHBlckNhc2UpID8/IHBhcnNlU3RyaW5nVG9FbnVtKFBvaW50U3R5bGUsIHNlZ21lbnRVcHBlckNhc2UpO1xuICAgICAgICAgICAgaWYgKHN0eWxlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlcXVhdGlvbi5zdHlsZSkge1xuICAgICAgICAgICAgICAgICAgICBlcXVhdGlvbi5zdHlsZSA9IHN0eWxlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgRHVwbGljYXRlIHN0eWxlIGlkZW50aWZpZXJzIGRldGVjdGVkOiAke2VxdWF0aW9uLnN0eWxlfSwgJHtzZWdtZW50fWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgdGhpcyBpcyBhIHZhbGlkIGNvbG9yIGNvbnN0YW50IG9yIGhleCBjb2RlXG4gICAgICAgICAgICBjb25zdCBjb2xvciA9IHBhcnNlQ29sb3Ioc2VnbWVudCk7XG4gICAgICAgICAgICBpZiAoY29sb3IpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVxdWF0aW9uLmNvbG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGVxdWF0aW9uLmNvbG9yID0gY29sb3I7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgYER1cGxpY2F0ZSBjb2xvciBpZGVudGlmaWVycyBkZXRlY3RlZCwgZWFjaCBlcXVhdGlvbiBtYXkgb25seSBjb250YWluIGEgc2luZ2xlIGNvbG9yIGNvZGUuYFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgdGhpcyBpcyBhIHZhbGlkIGxhYmVsIHN0cmluZ1xuICAgICAgICAgICAgaWYgKHNlZ21lbnRVcHBlckNhc2Uuc3RhcnRzV2l0aChcIkxBQkVMOlwiKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxhYmVsID0gc2VnbWVudC5zcGxpdChcIjpcIikuc2xpY2UoMSkuam9pbihcIjpcIikudHJpbSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVxdWF0aW9uLmxhYmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxhYmVsID09PSBcIlwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEVxdWF0aW9uIGxhYmVsIG11c3QgaGF2ZSBhIHZhbHVlYCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcXVhdGlvbi5sYWJlbCA9IGxhYmVsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgYER1cGxpY2F0ZSBlcXVhdGlvbiBsYWJlbHMgZGV0ZWN0ZWQsIGVhY2ggZXF1YXRpb24gbWF5IG9ubHkgY29udGFpbiBhIHNpbmdsZSBsYWJlbC5gXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHRoaXMgaXMgYSB2YWxpZCBkZWZ1bHQgbGFiZWwgc3RyaW5nXG4gICAgICAgICAgICBpZiAoc2VnbWVudFVwcGVyQ2FzZSA9PT0gXCJMQUJFTFwiKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgd2UgcGFzcyBhbiBlbXB0eSBzdHJpbmcgYXMgdGhlIGxhYmVsLFxuICAgICAgICAgICAgICAgIC8vICBEZXNtb3Mgd2lsbCB1c2UgdGhlIHNvdXJjZSBlcXVhdGlvbiBvZiB0aGUgcG9pbnQgYXMgdGhlIGxhYmVsXG4gICAgICAgICAgICAgICAgZXF1YXRpb24ubGFiZWwgPSBcIlwiO1xuXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIG5vbmUgb2YgdGhlIGFib3ZlLCBhc3N1bWUgaXQgaXMgYSBncmFwaCByZXN0cmljdGlvblxuICAgICAgICAgICAgaWYgKHNlZ21lbnQuaW5jbHVkZXMoXCJcXFxcXCIpKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHJlc3RyaWN0aW9uIGluY2x1ZGVkIGEgYFxcYCAodGhlIExhVGVYIGNvbnRyb2wgY2hhcmFjdGVyKSB0aGVuIHRoZSB1c2VyIG1heSBoYXZlIHRyaWVkIHRvIHVzZSB0aGUgTGFUZVggc3ludGF4IGluIHRoZSBncmFwaCByZXN0cmljdGlvbiAoZS5nIGBcXGZyYWN7MX17Mn1gKVxuICAgICAgICAgICAgICAgIC8vICBEZXNtb3MgZG9lcyBub3QgYWxsb3cgdGhpcyBidXQgcmV0dXJucyBhIGZhaXJseSBhcmNoYWljIGVycm9yIC0gXCJBIHBpZWNld2lzZSBleHByZXNzaW9uIG11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgY29uZGl0aW9uLlwiXG4gICAgICAgICAgICAgICAgY29uc3QgdmlldyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgICAgICAgICAgICAgIHByZS5pbm5lckhUTUwgPSBcIllvdSBtYXkgaGF2ZSB0cmllZCB0byB1c2UgdGhlIExhVGVYIHN5bnRheCBpbiB0aGUgZ3JhcGggcmVzdHJpY3Rpb24gKFwiO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNvZGVcIik7XG4gICAgICAgICAgICAgICAgaW5uZXIuaW5uZXJUZXh0ID0gc2VnbWVudDtcbiAgICAgICAgICAgICAgICBjb25zdCBwb3N0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gICAgICAgICAgICAgICAgcG9zdC5pbm5lckhUTUwgPVxuICAgICAgICAgICAgICAgICAgICBcIiksIHBsZWFzZSB1c2Ugc29tZSBzb3J0IG9mIGFuIGFsdGVybmF0aXZlIChlLmcgPGNvZGU+XFxcXGZyYWN7MX17Mn08L2NvZGU+ID0+IDxjb2RlPjEvMjwvY29kZT4pIGFzIHRoaXMgaXMgbm90IHN1cHBvcnRlZCBieSBEZXNtb3MuXCI7XG4gICAgICAgICAgICAgICAgdmlldy5hcHBlbmRDaGlsZChwcmUpO1xuICAgICAgICAgICAgICAgIHZpZXcuYXBwZW5kQ2hpbGQoaW5uZXIpO1xuICAgICAgICAgICAgICAgIHZpZXcuYXBwZW5kQ2hpbGQocG9zdCk7XG4gICAgICAgICAgICAgICAgaGludCA9IHsgdmlldyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWVxdWF0aW9uLnJlc3RyaWN0aW9ucykge1xuICAgICAgICAgICAgICAgIGVxdWF0aW9uLnJlc3RyaWN0aW9ucyA9IFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlcXVhdGlvbi5yZXN0cmljdGlvbnMucHVzaChzZWdtZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IGRhdGE6IGVxdWF0aW9uLCBoaW50IH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0aWMgcGFyc2VTZXR0aW5ncyhzZXR0aW5nczogc3RyaW5nKTogUGFydGlhbDxHcmFwaFNldHRpbmdzPiB7XG4gICAgICAgIGNvbnN0IGdyYXBoU2V0dGluZ3M6IFBhcnRpYWw8R3JhcGhTZXR0aW5ncz4gPSB7fTtcblxuICAgICAgICAvLyBTZXR0aW5ncyBtYXkgYmUgc2VwYXJhdGVkIGJ5IGVpdGhlciBhIG5ld2xpbmUgb3Igc2VtaWNvbG9uXG4gICAgICAgIHNldHRpbmdzXG4gICAgICAgICAgICAuc3BsaXQoL1s7XFxuXS9nKVxuICAgICAgICAgICAgLm1hcCgoc2V0dGluZykgPT4gc2V0dGluZy50cmltKCkpXG4gICAgICAgICAgICAuZmlsdGVyKChzZXR0aW5nKSA9PiBzZXR0aW5nICE9PSBcIlwiKVxuICAgICAgICAgICAgLy8gRXh0cmFjdCBrZXktdmFsdWUgcGFpcnMgYnkgc3BsaXR0aW5nIG9uIHRoZSBgPWAgaW4gZWFjaCBwcm9wZXJ0eVxuICAgICAgICAgICAgLm1hcCgoc2V0dGluZykgPT4gc2V0dGluZy5zcGxpdChcIj1cIikpXG4gICAgICAgICAgICAuZm9yRWFjaCgoc2V0dGluZykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChzZXR0aW5nLmxlbmd0aCA+IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgYFRvbyBtYW55IHNlZ21lbnRzLCBlYWNoaW5nIHNldHRpbmcgbXVzdCBvbmx5IGNvbnRhaW4gYSBtYXhpbXVtIG9mIG9uZSAnPScgc2lnbmBcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSBzZXR0aW5nWzBdLnRyaW0oKSBhcyBrZXlvZiBHcmFwaFNldHRpbmdzO1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gc2V0dGluZy5sZW5ndGggPiAxID8gc2V0dGluZ1sxXS50cmltKCkgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgICAgICAvLyBQcmV2ZW50IGR1cGxpY2F0ZSBrZXlzXG4gICAgICAgICAgICAgICAgaWYgKGtleSBpbiBncmFwaFNldHRpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgRHVwbGljYXRlIGtleSAnJHtrZXl9JyBub3QgYWxsb3dlZGApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVpcmVzVmFsdWUgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEZpZWxkICcke2tleX0nIG11c3QgaGF2ZSBhIHZhbHVlYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgc3dpdGNoIChrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQm9vbGVhbiBmaWVsZHNcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImhpZGVBeGlzTnVtYmVyc1wiOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiZ3JpZFwiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKGdyYXBoU2V0dGluZ3Nba2V5XSBhcyBib29sZWFuKSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvd2VyID0gdmFsdWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobG93ZXIgIT09IFwidHJ1ZVwiICYmIGxvd2VyICE9PSBcImZhbHNlXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYEZpZWxkICcke2tleX0nIHJlcXVyZXMgYSBib29sZWFuIHZhbHVlICd0cnVlJy8nZmFsc2UnIChvbWl0IGEgdmFsdWUgdG8gZGVmYXVsdCB0byAndHJ1ZScpYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChncmFwaFNldHRpbmdzW2tleV0gYXMgYm9vbGVhbikgPSB2YWx1ZSA9PT0gXCJ0cnVlXCIgPyB0cnVlIDogZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIEludGVnZXIgZmllbGRzXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJ0b3BcIjpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImJvdHRvbVwiOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwibGVmdFwiOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwicmlnaHRcIjpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIndpZHRoXCI6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJoZWlnaHRcIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWlyZXNWYWx1ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbnVtID0gcGFyc2VGbG9hdCh2YWx1ZSBhcyBzdHJpbmcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKE51bWJlci5pc05hTihudW0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBGaWVsZCAnJHtrZXl9JyBtdXN0IGhhdmUgYW4gaW50ZWdlciAob3IgZGVjaW1hbCkgdmFsdWVgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIChncmFwaFNldHRpbmdzW2tleV0gYXMgbnVtYmVyKSA9IG51bTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRGVncmVlTW9kZSBmaWVsZFxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiZGVncmVlTW9kZVwiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1aXJlc1ZhbHVlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtb2RlOiBEZWdyZWVNb2RlIHwgbnVsbCA9IHBhcnNlU3RyaW5nVG9FbnVtKERlZ3JlZU1vZGUsIHZhbHVlIGFzIHN0cmluZyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobW9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyYXBoU2V0dGluZ3MuZGVncmVlTW9kZSA9IG1vZGU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgRmllbGQgJ2RlZ3JlZU1vZGUnIG11c3QgYmUgZWl0aGVyICdyYWRpYW5zJyBvciAnZGVncmVlcydgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQ29sb3IgZmllbGRcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImRlZmF1bHRDb2xvclwiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1aXJlc1ZhbHVlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xvciA9IHBhcnNlQ29sb3IodmFsdWUgYXMgc3RyaW5nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb2xvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyYXBoU2V0dGluZ3MuZGVmYXVsdENvbG9yID0gY29sb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYEZpZWxkICdkZWZhdWx0Q29sb3InIG11c3QgYmUgZWl0aGVyIGEgdmFsaWQgaGV4IGNvZGUgb3Igb25lIG9mOiAke09iamVjdC5rZXlzKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ29sb3JDb25zdGFudFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApLmpvaW4oXCIsIFwiKX1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbnJlY29nbmlzZWQgZmllbGQ6ICR7a2V5fWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGdyYXBoU2V0dGluZ3M7XG4gICAgfVxuXG4gICAgLyoqIER5bmFtaWNhbGx5IGFkanVzdCBncmFwaCBib3VuZGFyeSBpZiB0aGUgZGVmYXVsdHMgd291bGQgY2F1c2UgYW4gaW52YWxpZCBncmFwaCB3aXRoIHRoZSBzZXR0aW5ncyBzdXBwbGllZCBieSB0aGUgdXNlcixcbiAgICAgKiAgdGhpcyB3aWxsIG5vdCBkbyBhbnl0aGluZyBpZiB0aGUgYWRqdXN0bWVudCBpcyBub3QgcmVxdWlyZWQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgYWRqdXN0Qm91bmRzKHNldHRpbmdzOiBQYXJ0aWFsPEdyYXBoU2V0dGluZ3M+KTogUGFydGlhbDxHcmFwaFNldHRpbmdzPiB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIHNldHRpbmdzLmxlZnQgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgc2V0dGluZ3MucmlnaHQgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgc2V0dGluZ3MubGVmdCA+PSBERUZBVUxUX0dSQVBIX1NFVFRJTkdTLnJpZ2h0XG4gICAgICAgICkge1xuICAgICAgICAgICAgc2V0dGluZ3MucmlnaHQgPSBzZXR0aW5ncy5sZWZ0ICsgREVGQVVMVF9HUkFQSF9XSURUSDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoXG4gICAgICAgICAgICBzZXR0aW5ncy5sZWZ0ID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIHNldHRpbmdzLnJpZ2h0ICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIHNldHRpbmdzLnJpZ2h0IDw9IERFRkFVTFRfR1JBUEhfU0VUVElOR1MubGVmdFxuICAgICAgICApIHtcbiAgICAgICAgICAgIHNldHRpbmdzLmxlZnQgPSBzZXR0aW5ncy5yaWdodCAtIERFRkFVTFRfR1JBUEhfV0lEVEg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgc2V0dGluZ3MuYm90dG9tICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIHNldHRpbmdzLnRvcCA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBzZXR0aW5ncy5ib3R0b20gPj0gREVGQVVMVF9HUkFQSF9TRVRUSU5HUy50b3BcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBzZXR0aW5ncy50b3AgPSBzZXR0aW5ncy5ib3R0b20gKyBERUZBVUxUX0dSQVBIX0hFSUdIVDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoXG4gICAgICAgICAgICBzZXR0aW5ncy5ib3R0b20gPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgc2V0dGluZ3MudG9wICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIHNldHRpbmdzLnRvcCA8PSBERUZBVUxUX0dSQVBIX1NFVFRJTkdTLmJvdHRvbVxuICAgICAgICApIHtcbiAgICAgICAgICAgIHNldHRpbmdzLmJvdHRvbSA9IHNldHRpbmdzLnRvcCAtIERFRkFVTFRfR1JBUEhfSEVJR0hUO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHNldHRpbmdzO1xuICAgIH1cbn1cbiJdfQ==