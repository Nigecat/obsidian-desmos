/** Unsafe cast method.
 *  Will transform the given type `F` into `T`,
 *      use only when you know this will be valid. */
export function ucast<F, T>(o: F): T {
    return o as unknown as T;
}
