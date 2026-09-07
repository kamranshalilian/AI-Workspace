export { AI_DIR_NAME, MANIFEST_FILE_NAME } from "../config/constants.js";
export {
  aiDirFor,
  discoverScope,
  hasManifest,
  manifestPathFor,
  realPathIfExists,
  type ScopeLocation,
} from "./discovery.js";
export { isExcluded, matchesAnyGlob, matchesGlob } from "./exclusions.js";
export {
  fileSize,
  isBinaryBuffer,
  isDirectory,
  isFile,
  pathExists,
  readFileBytes,
  readFilePrefix,
  sha256,
  walkFiles,
  writeFileAtomic,
  type WalkedFile,
} from "./io.js";
export {
  comparePosix,
  firstPosixSegment,
  isInsideOrEqual,
  isStrictDescendant,
  posixBasename,
  posixDirname,
  posixJoin,
  posixStem,
  relativePosix,
  resolveFromBase,
  toNativePath,
  toPosixPath,
} from "./paths.js";
