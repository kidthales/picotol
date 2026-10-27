/**
 * @kidthales/picotol ambient TypeScript declarations
 *
 * Provides ambient module definitions for Picotol stylesheets,
 * design tokens, and canonical Paul Tol qualitative palette data.
 */

declare namespace Picotol {
  /**
   * The 10 canonical Paul Tol qualitative scheme identifiers.
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

  /**
   * Individual color entry with hex value and optional semantic/color name.
   */
  export interface TolColor {
    hex: string;
    name?: string;
  }

  /**
   * Canonical achromatic stop mapped from scientific Paul Tol data.
   */
  export interface TolAchromaticStop {
    name: string;
    hex: string;
    sourceScheme: string;
  }

  /**
   * Qualitative scheme definition containing distinct, accessible swatches.
   */
  export interface TolScheme {
    id: TolQualitativeSchemeId | string;
    kind: 'qualitative' | string;
    colors: TolColor[];
    extras?: TolColor[];
    bad?: string;
  }

  /**
   * Complete qualitative palette data snapshot exported by @kidthales/picotol/palette-data.
   */
  export interface TolQualitativeData {
    schemes: Record<TolQualitativeSchemeId, TolScheme> & Record<string, TolScheme>;
    achromatic: TolAchromaticStop[];
    allowedHexes: string[];
  }

  /**
   * Subresource Integrity (SRI) file record with size and sha384 digest.
   */
  export interface SriFileRecord {
    bytes: number;
    gzipBytes: number;
    integrity: string;
  }

  /**
   * SRI manifest structure exported by @kidthales/picotol/sri.
   */
  export interface SriManifest {
    package: string;
    version: string;
    files: Record<string, SriFileRecord>;
  }
}

// ============================================================================
// Ambient Module Declarations: Root & Stylesheet Subpaths
// ============================================================================

declare module '@kidthales/picotol' {
  export type TolQualitativeSchemeId = Picotol.TolQualitativeSchemeId;
  export type TolColor = Picotol.TolColor;
  export type TolAchromaticStop = Picotol.TolAchromaticStop;
  export type TolScheme = Picotol.TolScheme;
  export type TolQualitativeData = Picotol.TolQualitativeData;
  export type SriFileRecord = Picotol.SriFileRecord;
  export type SriManifest = Picotol.SriManifest;

  const styles: string;
  export default styles;
}

declare module '@kidthales/picotol/css' {
  const styles: string;
  export default styles;
}

declare module '@kidthales/picotol/core' {
  const styles: string;
  export default styles;
}

declare module '@kidthales/picotol/core/css' {
  const styles: string;
  export default styles;
}

declare module '@kidthales/picotol/layer' {
  const styles: string;
  export default styles;
}

declare module '@kidthales/picotol/layer/css' {
  const styles: string;
  export default styles;
}

declare module '@kidthales/picotol/tokens' {
  const styles: string;
  export default styles;
}

declare module '@kidthales/picotol/palettes' {
  const styles: string;
  export default styles;
}

// ============================================================================
// Ambient Module Declaration: Palette Data Subpath
// ============================================================================

declare module '@kidthales/picotol/palette-data' {
  export type TolQualitativeSchemeId = Picotol.TolQualitativeSchemeId;
  export type TolColor = Picotol.TolColor;
  export type TolAchromaticStop = Picotol.TolAchromaticStop;
  export type TolScheme = Picotol.TolScheme;
  export type TolQualitativeData = Picotol.TolQualitativeData;

  export const schemes: Record<Picotol.TolQualitativeSchemeId, Picotol.TolScheme> &
    Record<string, Picotol.TolScheme>;
  export const achromatic: Picotol.TolAchromaticStop[];
  export const allowedHexes: string[];

  const data: Picotol.TolQualitativeData;
  export default data;
}

// ============================================================================
// Ambient Module Declaration: SRI Manifest Subpath
// ============================================================================

declare module '@kidthales/picotol/sri' {
  export type SriFileRecord = Picotol.SriFileRecord;
  export type SriManifest = Picotol.SriManifest;

  export const package: string;
  export const version: string;
  export const files: Record<string, Picotol.SriFileRecord>;

  const manifest: Picotol.SriManifest;
  export default manifest;
}
