export type Hash = string;

/** Calculate a unique SHA-256 hash for the given object */
export async function calculateHash<T>(val: T): Promise<Hash> {
    const data = new TextEncoder().encode(JSON.stringify(val));
    const buffer = await crypto.subtle.digest("SHA-256", data);
    const raw = Array.from(new Uint8Array(buffer));
    // Convery binary hash to hex
    const hash = raw.map((b) => b.toString(16).padStart(2, "0")).join("");

    return hash;
}

/** Unsafe cast method.
 *  Will transform the given type `F` into `T`,
 *      use only when you know this will be valid. */
export function ucast<F, T>(o: F): T {
    return o as unknown as T;
}
