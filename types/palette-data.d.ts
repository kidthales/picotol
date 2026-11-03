/**
 * @kidthales/picotol qualitative palette data declarations
 *
 * Provides type definitions and default export matching data/tol-qualitative.json.
 */

export type TolQualitativeSchemeId =
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
  id: TolQualitativeSchemeId | string;
  kind: 'qualitative' | string;
  colors: TolColor[];
  extras?: TolColor[];
  bad?: string;
}

export interface TolQualitativeData {
  schemes: Record<TolQualitativeSchemeId, TolScheme> & Record<string, TolScheme>;
  achromatic: TolAchromaticStop[];
  allowedHexes: string[];
}

declare const data: TolQualitativeData;
export default data;
