export interface GraphSettings {
    /** The width of the rendered graoh */
    width: number;
    /** The height of the rendered graph */
    height: number;
    /** The left bound of the graph */
    left: number;
    /** The right bound of the graph */
    right: number;
    /** The bottom bound of the graph */
    bottom: number;
    /** The top bound of the graph */
    top: number;
    /** Whether to show the grid or not, defaults to `true` */
    grid: boolean;
}

export interface Equation {
    equation: string;
    restriction?: string;
    style?: EquationStyle | PointStyle;
    color?: ColorConstant | HexColor;
}

export enum EquationStyle {
    SOLID = "SOLID",
    DASHED = "DASHED",
    DOTTED = "DOTTED",
}

export enum PointStyle {
    POINT = "POINT",
    OPEN = "OPEN",
    CROSS = "CROSS",
}

export enum DegreeMode {
    RADIANS = "radians",
    DEGREES = "degrees",
}

export type HexColor = string;

export enum ColorConstant {
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
