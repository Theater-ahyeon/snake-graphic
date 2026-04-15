const SAVE_ARCHIVE_VERSION = 1;
const STORAGE_KEYS = [
  "neon-snake-best-scores",
  "neon-snake-career",
  "neon-snake-campaign-progress-v2",
  "neon-snake-best-replays-v2",
  "neon-snake-ui-settings-v2"
] as const;

export interface DesktopMeta {
  isDesktop: boolean;
  version: string;
  platform: string;
  userDataPath: string;
}

interface ExportSaveResult {
  canceled: boolean;
  filePath?: string;
}

interface ImportSaveResult {
  canceled: boolean;
  filePath?: string;
  content?: string;
}

interface OpenDataDirectoryResult {
  ok: boolean;
  path: string;
  error?: string;
}

interface SaveArchive {
  app: "Neon Snake Studio";
  version: number;
  exportedAt: string;
  values: Partial<Record<(typeof STORAGE_KEYS)[number], string | null>>;
}

interface DesktopBridge {
  meta: DesktopMeta;
  exportSave(payload: { suggestedName: string; content: string }): Promise<ExportSaveResult>;
  importSave(): Promise<ImportSaveResult>;
  openDataDirectory(): Promise<OpenDataDirectoryResult>;
}

declare global {
  interface Window {
    neonSnakeDesktop?: DesktopBridge;
  }
}

function getBridge(): DesktopBridge | null {
  return window.neonSnakeDesktop ?? null;
}

export function getDesktopMeta(): DesktopMeta | null {
  return getBridge()?.meta ?? null;
}

export function isDesktopEnvironment(): boolean {
  return Boolean(getDesktopMeta()?.isDesktop);
}

function buildArchive(): SaveArchive {
  const values = Object.fromEntries(
    STORAGE_KEYS.map((key) => [key, window.localStorage.getItem(key)])
  ) as SaveArchive["values"];

  return {
    app: "Neon Snake Studio",
    version: SAVE_ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    values
  };
}

function isSaveArchive(value: unknown): value is SaveArchive {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SaveArchive>;
  return (
    candidate.app === "Neon Snake Studio" &&
    typeof candidate.version === "number" &&
    Boolean(candidate.values) &&
    typeof candidate.values === "object"
  );
}

export async function exportDesktopSave(): Promise<ExportSaveResult> {
  const bridge = getBridge();
  if (!bridge) {
    throw new Error("Desktop bridge is unavailable.");
  }

  const archive = buildArchive();
  return bridge.exportSave({
    suggestedName: `neon-snake-save-${new Date().toISOString().slice(0, 10)}.json`,
    content: JSON.stringify(archive, null, 2)
  });
}

export async function importDesktopSave(): Promise<ImportSaveResult & { archive?: SaveArchive }> {
  const bridge = getBridge();
  if (!bridge) {
    throw new Error("Desktop bridge is unavailable.");
  }

  const result = await bridge.importSave();
  if (result.canceled || !result.content) {
    return result;
  }

  const parsed = JSON.parse(result.content) as unknown;
  if (!isSaveArchive(parsed)) {
    throw new Error("Invalid Neon Snake Studio save file.");
  }

  STORAGE_KEYS.forEach((key) => {
    const value = parsed.values[key];
    if (typeof value === "string") {
      window.localStorage.setItem(key, value);
      return;
    }
    window.localStorage.removeItem(key);
  });

  return {
    ...result,
    archive: parsed
  };
}

export async function openDesktopDataDirectory(): Promise<OpenDataDirectoryResult> {
  const bridge = getBridge();
  if (!bridge) {
    throw new Error("Desktop bridge is unavailable.");
  }

  return bridge.openDataDirectory();
}
