export function ucast<F, T>(o: F): T {
    return o as unknown as T;
}
