/**
 * TypeScript Type Definitions for INDRA OCR Web
 * Pure in-browser client-side document recognition and parsing
 */

export type BoundingBox = [number, number, number, number] | [number, number, number, number, number];

export interface OCRLine {
  /** Pixel coordinates [x0, y0, x1, y1] on the original document */
  box: [number, number, number, number];
  /** Recognized text content */
  text: string;
  /** Confidence score between 0.0 and 1.0 */
  conf: number;
  /** Original detected line index prior to reading order re-sorting */
  origIdx?: number;
  /** Whether the line was classified as CJK script */
  cjk?: boolean;
}

export interface DetResult {
  pi: {
    dims: [number, number, number, number];
    scale: number;
  };
  boxes: BoundingBox[];
  bumped?: boolean;
  medH?: number;
}

export interface OCRPageResult {
  /** Array of recognized lines in reading order */
  lines: OCRLine[];
  /** Structured Markdown document */
  md: string;
  /** Processing time in milliseconds */
  time: number;
  /** Detection metadata */
  det: DetResult;
  /** Degrees clockwise input was rotated upright (0, 90, 180, 270) */
  rotation?: number;
  /** Source channel: "ocr" or "text" (for digital PDFs) */
  source?: "ocr" | "text";
  /** Page label */
  label?: string;
  /** 1-based page number */
  pageNo?: number;
  /** Total pages in document */
  pageTotal?: number;
}

export interface OCROptions {
  /** Input long side resolution (default: 1024) */
  longSide?: number;
  /** Enable adaptive multi-scale re-detection for dense small text (default: true) */
  adaptive?: boolean;
  /** Minimum confidence threshold (default: 0.5) */
  minConf?: number;
  /** Enable automatic orientation deskew via orient.onnx (default: true) */
  orient?: boolean;
}

export interface ModelLoadProgress {
  file: string;
  got: number;
  total: number;
  frac: number;
  done: number;
}

export interface ModelCompilePhase {
  file: string;
  done: number;
}

export interface ModelLoadOptions {
  /** Optional local File/Blob instances for offline loading (det.onnx, rec.onnx, etc.) */
  localFiles?: Record<string, File | Blob>;
  /** Number of WASM threads to allocate (default: auto, capped at 4) */
  threads?: number;
  /** Progress callback during model weights download */
  onProgress?: (progress: ModelLoadProgress) => void;
  /** Phase callback during inference session compilation */
  onPhase?: (phase: ModelCompilePhase) => void;
  /** Internal logging callback */
  onLog?: (log: { level: string; msg: string; file?: string }) => void;
}

export interface ModelInfo {
  meta: {
    longSide: number;
    recHeight: number;
    latin: number;
    cjk: number;
  };
  threads: number;
  ms: number;
}

export interface OCREvents {
  stage?: (name: "orient" | "detect" | "script" | "recognize" | "order" | "markdown" | string, info?: Record<string, any>) => void;
  mark?: (name: "orient" | "resize" | "det" | "decode" | "script" | "rec" | "order" | string, ms: number) => void;
  orient?: (info: { k: number; rotation: number }) => void;
  boxes?: (boxes: BoundingBox[]) => void;
  line?: (line: OCRLine) => void;
}

/**
 * Loads and initializes the 6 Indra ONNX neural models via ONNX Runtime Web.
 */
export function loadModels(options?: ModelLoadOptions): Promise<ModelInfo>;

/**
 * Performs full end-to-end OCR and layout parsing on an image bitmap.
 */
export function ocrPage(
  image: ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas,
  events?: OCREvents
): Promise<OCRPageResult>;

/**
 * Converts recognized lines and layout classification tensors to structured Markdown.
 */
export function toMarkdown(lines: OCRLine[], clsTensor?: Float32Array | null): string;

/**
 * Updates runtime OCR options.
 */
export function setOpts(options: Partial<OCROptions>): void;

/**
 * Signals abort to the active OCR pipeline.
 */
export function setAbort(abort: boolean): void;

/**
 * Calculates connected components on a binary mask.
 */
export function components(mask: Uint8Array, w: number, h: number): {
  lab: Int32Array;
  stats: Array<{ left: number; top: number; w: number; h: number; area: number }>;
};

/**
 * Recursive XY-cut layout algorithm.
 */
export function xycut(boxes: BoundingBox[], ids: number[]): number[];

/**
 * Decodes pairwise reading order logits into sequential indices.
 */
export function decodeOrder(a: Float32Array | Float64Array, n: number, stride?: number, sweeps?: number): number[];

/**
 * Clusters lines into semantic blocks using average linkage.
 */
export function cluster(logits: Float32Array | Float64Array, n: number, stride: number): number[][];
