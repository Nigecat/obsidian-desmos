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
    restrictions?: string[];
    style?: LineStyle | PointStyle;
    color?: ColorConstant | HexColor;
    hidden?: boolean;
}

export enum LineStyle {
    Solid = "SOLID",
    Dashed = "DASHED",
    Dotted = "DOTTED",
}

export enum PointStyle {
    Point = "POINT",
    Open = "OPEN",
    Cross = "CROSS",
}

export type HexColor = string;

export enum ColorConstant {
    Red = "#ff0000",
    Green = "#00ff00",
    Blue = "#0000ff",

    Yellow = "#ffff00",
    Magenta = "#ff00ff",
    Cyan = "#00ffff",

    Purple = "#cc8899",
    Orange = "#ffa500",
    Black = "#000000",
    White = "#ffffff",
}
