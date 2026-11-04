import paletteData, {
  type TolColor,
  type TolQualitativeData,
  type TolPaletteData,
  type TolQualitativeSchemeId,
  type TolSchemeId,
  type TolSchemeKind,
  type TolScheme,
  type TolAchromaticStop,
} from '@kidthales/picotol/palette-data';
import sri, {
  type SriFileRecord,
  type SriManifest,
} from '@kidthales/picotol/sri';

// Verify @kidthales/picotol/palette-data types and runtime structure
const data: TolQualitativeData = paletteData;
const paletteDataAlias: TolPaletteData = paletteData;
const brightScheme: TolScheme = data.schemes.bright;
const firstColor: TolColor = brightScheme.colors[0];
const colorHex: string = firstColor.hex;
const colorName: string | undefined = firstColor.name;
const schemeId: TolQualitativeSchemeId | string = brightScheme.id;
const newSchemeId: TolSchemeId = 'bright';
const brightKind: TolSchemeKind | string = brightScheme.kind;
const prgnScheme: TolScheme = data.schemes.prgn;
const prgnKind: TolSchemeKind | string = prgnScheme.kind;
const ylorbrScheme: TolScheme = data.schemes.ylorbr;
const ylorbrKind: TolSchemeKind | string = ylorbrScheme.kind;
const achromaticStop: TolAchromaticStop = data.achromatic[0];
const allowedHex: string = data.allowedHexes[0];

// Verify @kidthales/picotol/sri types and runtime structure
const manifest: SriManifest = sri;
const packageName: string = manifest.package;
const packageVersion: string = manifest.version;
const fileRecord: SriFileRecord = manifest.files['dist/picotol.min.css'];
const fileIntegrity: string = fileRecord.integrity;
const fileBytes: number = fileRecord.bytes;
const gzipBytes: number = fileRecord.gzipBytes;

void paletteDataAlias;
void colorHex;
void colorName;
void schemeId;
void newSchemeId;
void brightKind;
void prgnKind;
void ylorbrKind;
void achromaticStop;
void allowedHex;
void packageName;
void packageVersion;
void fileIntegrity;
void fileBytes;
void gzipBytes;
