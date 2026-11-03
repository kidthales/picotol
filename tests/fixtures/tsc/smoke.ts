import paletteData, {
  type TolColor,
  type TolQualitativeData,
  type TolQualitativeSchemeId,
  type TolScheme,
  type TolAchromaticStop,
} from '@kidthales/picotol/palette-data';
import sri, {
  type SriFileRecord,
  type SriManifest,
} from '@kidthales/picotol/sri';

// Verify @kidthales/picotol/palette-data types and runtime structure
const data: TolQualitativeData = paletteData;
const brightScheme: TolScheme = data.schemes.bright;
const firstColor: TolColor = brightScheme.colors[0];
const colorHex: string = firstColor.hex;
const colorName: string | undefined = firstColor.name;
const schemeId: TolQualitativeSchemeId | string = brightScheme.id;
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

void colorHex;
void colorName;
void schemeId;
void achromaticStop;
void allowedHex;
void packageName;
void packageVersion;
void fileIntegrity;
void fileBytes;
void gzipBytes;
