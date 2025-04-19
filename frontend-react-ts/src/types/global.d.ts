declare global {
  interface Window {
    _devFlags: {
      [key: string]: any;
      hasJustPasted?: boolean;
      pasteVersion?: number;
      debugMode?: boolean;
    };
  }
} 