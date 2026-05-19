/**
 * Shared cross-cutting types live in `@/types`. Domain-specific types stay
 * colocated with their module (`@/modules/<domain>/types.ts`).
 */

export type Lonlat = readonly [longitude: number, latitude: number]

export type Lonlatalt = readonly [longitude: number, latitude: number, altitude: number]

export type Maybe<T> = T | null | undefined

export type Nullable<T> = T | null

export interface Disposable {
  dispose(): void
}
