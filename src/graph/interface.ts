export interface GraphSettings {
    /** The width of the rendered graoh */
    width: Size;
    /** The height of the rendered graph */
    height: Size;
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
    /** The option to skip the cache in order for dynamically sized svgs to properly render */
    skipCache: boolean;
    /** The default color to set all equations to.
     *  If this is not specified, each equation will be a random {@link ColorConstant} (assigned by Desmos).
     */
    defaultColor?: Color;
}

export enum AbsoluteCSSUnit {
    cm = "cm",
    mm = "mm",
    in = "in",
    px = "px",
    pt = "pt",
    pc = "pc"
}

export enum RelativeCSSUnit {
    em = "em",
    ch = "ch",
    rem = "rem",
    vw = "vw",
    vh = "vh",
    vmin = "vmin",
    vmax = "vmax",
    percent = "%"
}

export type CSSUnit = AbsoluteCSSUnit | RelativeCSSUnit

export interface Size {
    value: number,
    unit: CSSUnit
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
