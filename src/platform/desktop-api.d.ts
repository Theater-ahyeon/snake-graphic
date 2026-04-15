export {};

declare global {
  interface Window {
    neonSnakeDesktop?: {
      meta: {
        isDesktop: boolean;
        version: string;
        platform: string;
        userDataPath: string;
      };
      exportSave(payload: {
        suggestedName: string;
        content: string;
      }): Promise<{ canceled: boolean; filePath?: string }>;
      importSave(): Promise<{ canceled: boolean; filePath?: string; content?: string }>;
      openDataDirectory(): Promise<{ ok: boolean; path: string; error?: string }>;
    };
  }
}
