/**
 * @kidthales/picotol Subresource Integrity (SRI) manifest declarations
 *
 * Provides type definitions and default export matching dist/sri.json.
 */

export interface SriFileRecord {
  bytes: number;
  gzipBytes: number;
  integrity: string;
}

export interface SriManifest {
  package: string;
  version: string;
  files: Record<string, SriFileRecord>;
}

declare const manifest: SriManifest;
export default manifest;
