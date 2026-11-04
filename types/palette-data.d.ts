/**
 * @kidthales/picotol palette data declarations
 *
 * Provides type definitions and default export matching data/tol-qualitative.json.
 * Covers 10 Paul Tol schemes (8 qualitative, 1 diverging, 1 sequential)
 * plus canonical achromatic stops.
 */

export type TolSchemeId =
  | 'bright'
  | 'dark'
  | 'high-contrast'
  | 'light'
  | 'medium-contrast'
  | 'muted'
  | 'pale'
  | 'prgn'
  | 'vibrant'
  | 'ylorbr';

/**
 * Backward-compatible alias for the 10 bundled Paul Tol scheme identifiers.
 */
export type TolQualitativeSchemeId = TolSchemeId;

export type TolSchemeKind = 'qualitative' | 'diverging' | 'sequential';

export interface TolColor {
  hex: string;
  name?: string;
}

export interface TolAchromaticStop {
  name: string;
  hex: string;
  sourceScheme: string;
}

export interface TolScheme {
  id: TolSchemeId | string;
  kind: TolSchemeKind | string;
  colors: TolColor[];
  extras?: TolColor[];
  bad?: string;
}

export interface TolQualitativeData {
  schemes: Record<TolSchemeId, TolScheme> & Record<string, TolScheme>;
  achromatic: TolAchromaticStop[];
  allowedHexes: string[];
}

/**
 * Backward-compatible alias for TolQualitativeData covering all 10 schemes.
 */
export type TolPaletteData = TolQualitativeData;

declare const data: TolQualitativeData;
export default data;
