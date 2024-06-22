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
    /** The degree mode to use for trigenometry functions, defaults to `radians` */
    degreeMode: DegreeMode;
    /** Whether to hide all axis numbers, defaults to `false` */
    hideAxisNumbers: boolean;
    /** The label placed below x axis */
    xAxisLabel?: string;
    /** The label placed beside the y axis */
    yAxisLabel?: string;
    /** Whether the x-axis should be logarithmic, defaults to `false */
    xAxisLogarithmic: boolean;
    /** Whether the y-axis should be logarithmic, defaults to `false */
    yAxisLogarithmic: boolean;
    /** The default color to set all equations to.
     *  If this is not specified, each equation will be a random {@link ColorConstant} (assigned by Desmos).
     */
    defaultColor?: Color;
}

export enum DegreeMode {
    Radians = "RADIANS",
    Degrees = "DEGREES",
}

export interface Equation {
    equation: string;
    restrictions?: string[];
    style?: LineStyle | PointStyle;
    color?: ColorConstant | HexColor;
    hidden?: boolean;
    label?: string;
    line?: boolean;
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

export type Color = HexColor | ColorConstant;

export type HexColor = string;

export enum ColorConstant {
    Red = "#ff0000",
    Green = "#00ff00",
    Blue = "#0000ff",

    Yellow = "#ffff00",
    Magenta = "#ff00ff",
    Cyan = "#00ffff",

    Purple = "#6042a6",
    Orange = "#ffa500",
    Black = "#000000",
    White = "#ffffff",
}
