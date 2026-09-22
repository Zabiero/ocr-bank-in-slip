import { orientation as readExifOrientation } from 'exifr';

const PDF_WORKER_URL = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

async function renderPdfFirstPageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function convertHeicToJpegFile(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default;
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const blob = Array.isArray(result) ? result[0] : result;
  return new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
}

function isHeic(file: File): boolean {
  return /\.heic$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
}

function loadImageBitmapSource(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}

/** Draws an image onto a canvas, undoing EXIF rotation/mirroring (orientation 1-8). */
function drawWithOrientation(img: HTMLImageElement, orientationValue: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const swap = orientationValue >= 5 && orientationValue <= 8;
  canvas.width = swap ? img.naturalHeight : img.naturalWidth;
  canvas.height = swap ? img.naturalWidth : img.naturalHeight;
  const ctx = canvas.getContext('2d')!;

  switch (orientationValue) {
    case 2:
      ctx.transform(-1, 0, 0, 1, canvas.width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, canvas.width, canvas.height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, canvas.height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, canvas.width, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, canvas.width, canvas.height);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, canvas.height);
      break;
    default:
      break; // orientation 1 (or unknown): no transform needed
  }

  ctx.drawImage(img, 0, 0);
  return canvas;
}

/** Loads any supported input (JPG/PNG/HEIC/PDF) into an upright canvas. */
export async function loadFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    return renderPdfFirstPageToCanvas(file);
  }

  const imageFile = isHeic(file) ? await convertHeicToJpegFile(file) : file;
  const [img, orientationValue] = await Promise.all([
    loadImageBitmapSource(imageFile),
    readExifOrientation(imageFile).catch(() => 1),
  ]);

  return drawWithOrientation(img, orientationValue ?? 1);
}

function toGrayscale(canvas: HTMLCanvasElement): { data: Uint8ClampedArray; width: number; height: number } {
  const ctx = canvas.getContext('2d')!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { data: gray, width, height };
}

function grayscaleToCanvas(gray: Uint8ClampedArray, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  for (let p = 0; p < gray.length; p++) {
    const v = gray[p];
    imageData.data[p * 4] = v;
    imageData.data[p * 4 + 1] = v;
    imageData.data[p * 4 + 2] = v;
    imageData.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Rotates a canvas by angleDeg around its center, expanding the canvas so nothing is clipped. Corners are filled white. */
function rotateCanvas(canvas: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  if (Math.abs(angleDeg) < 0.05) return canvas;

  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const newWidth = Math.round(canvas.width * cos + canvas.height * sin);
  const newHeight = Math.round(canvas.width * sin + canvas.height * cos);

  const rotated = document.createElement('canvas');
  rotated.width = newWidth;
  rotated.height = newHeight;
  const ctx = rotated.getContext('2d')!;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, newWidth, newHeight);
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return rotated;
}

/**
 * Scores how "horizontally banded" a grayscale image is: perfectly horizontal
 * text lines create sharp row-to-row swings in darkness (in a line vs.
 * between lines), which rotation smears into a flatter profile. Used to pick
 * the rotation angle that best straightens whatever text dominates the
 * frame.
 */
function horizontalBandingScore(gray: Uint8ClampedArray, width: number, height: number): number {
  const rowDarkness = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const base = y * width;
    for (let x = 0; x < width; x++) sum += 255 - gray[base + x];
    rowDarkness[y] = sum;
  }
  let variance = 0;
  for (let y = 1; y < height; y++) {
    const d = rowDarkness[y] - rowDarkness[y - 1];
    variance += d * d;
  }
  return variance;
}

/**
 * Detects a document's rotation by testing candidate angles on a small
 * downsampled copy and picking whichever produces the sharpest horizontal
 * text-line banding (see horizontalBandingScore). A coarse pass across a
 * wide range is refined with a finer pass around the best coarse angle.
 * Cheap (~30 small rotations) since it operates on a <=300px copy, not the
 * full-resolution photo.
 */
function detectSkewAngle(canvas: HTMLCanvasElement): number {
  const scale = Math.min(1, 300 / Math.max(canvas.width, canvas.height));
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(canvas.width * scale));
  small.height = Math.max(1, Math.round(canvas.height * scale));
  small.getContext('2d')!.drawImage(canvas, 0, 0, small.width, small.height);
  const { data: baseGray, width: baseWidth, height: baseHeight } = toGrayscale(small);
  const baseCanvas = grayscaleToCanvas(baseGray, baseWidth, baseHeight);

  const scoreAt = (angleDeg: number): number => {
    const rotated = rotateCanvas(baseCanvas, angleDeg);
    const { data, width, height } = toGrayscale(rotated);
    return horizontalBandingScore(data, width, height);
  };

  let bestAngle = 0;
  let bestScore = scoreAt(0);
  for (let angle = -20; angle <= 20; angle += 2) {
    if (angle === 0) continue;
    const score = scoreAt(angle);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  const coarse = bestAngle;
  for (let angle = coarse - 1.75; angle <= coarse + 1.75; angle += 0.25) {
    const score = scoreAt(angle);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  return bestAngle;
}

/**
 * Otsu's method: picks the luminance threshold that best separates a photo
 * into two classes (foreground/background) by maximizing the variance
 * between them, instead of assuming a fixed brightness level. A photo taken
 * in normal indoor lighting can have a mean luminance well under 150 even
 * though the paper itself reads as "white" to a human eye adjusting for
 * context - a fixed threshold tuned for a bright, evenly-lit scan (e.g. 235)
 * can end up classifying almost the entire photo as "dark content",
 * defeating any crop or contrast step built on top of it.
 */
function otsuThreshold(histogram: Uint32Array, totalPixels: number): number {
  const sumAll = histogram.reduce((sum, count, level) => sum + count * level, 0);
  let sumBackground = 0;
  let weightBackground = 0;
  let bestVariance = 0;
  let bestThreshold = 0;

  for (let level = 0; level < 256; level++) {
    weightBackground += histogram[level];
    if (weightBackground === 0) continue;
    const weightForeground = totalPixels - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += level * histogram[level];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumAll - sumBackground) / weightForeground;
    const betweenVariance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (betweenVariance > bestVariance) {
      bestVariance = betweenVariance;
      bestThreshold = level;
    }
  }

  return bestThreshold;
}

/**
 * Finds the document in a photo instead of bounding-boxing every dark pixel
 * in the frame, which includes any other papers, handwriting or notebook
 * also in shot. Works on a coarse grid: each cell's dark-pixel density
 * (against an Otsu-computed threshold, not a fixed one - see otsuThreshold)
 * decides whether it counts as "content", then a flood fill groups
 * 4-connected content cells into blobs.
 *
 * A real document's own text is usually split across multiple blobs at this
 * granularity - e.g. a receipt's header and body, separated by a plain gap -
 * while genuine clutter (a stray handwriting scrap, a ruled notebook line)
 * forms much smaller blobs. So rather than keeping only the single largest
 * blob, every blob at least SUBSTANTIAL_BLOB_FRACTION the size of the
 * largest one is merged into the final crop - keeps the document's own
 * separate sections together while still dropping small, unrelated marks.
 *
 * Not a substitute for real perspective/contour detection (see the module
 * doc comment) - clutter directly touching the document's own edge still
 * merges into the same blob - but a real improvement over a global bounding
 * box for anything not touching it.
 */
function autoCropBounds(imageData: ImageData): { x: number; y: number; width: number; height: number } {
  const { data, width, height } = imageData;

  const luminanceHistogram = new Uint32Array(256);
  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    luminance[p] = l;
    luminanceHistogram[l]++;
  }
  const darkThreshold = otsuThreshold(luminanceHistogram, width * height);

  // ~60 cells along the longer edge: coarse enough to average out individual
  // character/line gaps into a stable per-cell density, fine enough to keep
  // spatially separate clutter in its own blob.
  const cellSize = Math.max(4, Math.round(Math.max(width, height) / 60));
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);

  const darkCount = new Int32Array(cols * rows);
  const totalCount = new Int32Array(cols * rows);

  for (let y = 0; y < height; y++) {
    const row = Math.min(rows - 1, Math.floor(y / cellSize));
    for (let x = 0; x < width; x++) {
      const col = Math.min(cols - 1, Math.floor(x / cellSize));
      const idx = row * cols + col;
      totalCount[idx]++;
      if (luminance[y * width + x] < darkThreshold) darkCount[idx]++;
    }
  }

  // A cell counts as "content" once a meaningful fraction of it is ink -
  // dense text clears this easily; a single thin ruled line or a sparse
  // handwriting stroke passing through a cell usually doesn't.
  const DENSITY_THRESHOLD = 0.2;
  const isContent = new Uint8Array(cols * rows);
  for (let c = 0; c < cols * rows; c++) {
    isContent[c] = totalCount[c] > 0 && darkCount[c] / totalCount[c] > DENSITY_THRESHOLD ? 1 : 0;
  }

  const visited = new Uint8Array(cols * rows);
  const blobs: { minCol: number; maxCol: number; minRow: number; maxRow: number; cellCount: number }[] = [];

  for (let start = 0; start < cols * rows; start++) {
    if (!isContent[start] || visited[start]) continue;

    const stack = [start];
    visited[start] = 1;
    let cellCount = 0;
    let minCol = cols;
    let maxCol = -1;
    let minRow = rows;
    let maxRow = -1;

    while (stack.length) {
      const idx = stack.pop()!;
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      cellCount++;
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;

      const neighbors = [
        row > 0 ? idx - cols : -1,
        row < rows - 1 ? idx + cols : -1,
        col > 0 ? idx - 1 : -1,
        col < cols - 1 ? idx + 1 : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && isContent[n] && !visited[n]) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }

    blobs.push({ minCol, maxCol, minRow, maxRow, cellCount });
  }

  if (blobs.length === 0) {
    return { x: 0, y: 0, width, height };
  }

  const SUBSTANTIAL_BLOB_FRACTION = 0.15;
  const largestCellCount = Math.max(...blobs.map((b) => b.cellCount));
  const substantialBlobs = blobs.filter((b) => b.cellCount >= largestCellCount * SUBSTANTIAL_BLOB_FRACTION);

  const minCol = Math.min(...substantialBlobs.map((b) => b.minCol));
  const maxCol = Math.max(...substantialBlobs.map((b) => b.maxCol));
  const minRow = Math.min(...substantialBlobs.map((b) => b.minRow));
  const maxRow = Math.max(...substantialBlobs.map((b) => b.maxRow));

  const padCols = Math.max(1, Math.round((maxCol - minCol + 1) * 0.04));
  const padRows = Math.max(1, Math.round((maxRow - minRow + 1) * 0.04));

  const x = Math.max(0, (minCol - padCols) * cellSize);
  const y = Math.max(0, (minRow - padRows) * cellSize);
  const right = Math.min(width, (maxCol + 1 + padCols) * cellSize);
  const bottom = Math.min(height, (maxRow + 1 + padRows) * cellSize);

  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Local adaptive binarization: each pixel is compared against the average
 * luminance of its own neighborhood, not one threshold for the whole image.
 *
 * A phone photo of a document frequently has uneven lighting - a glare band,
 * a shadow, a gradient across the frame from an angled light source. A
 * single global threshold (or a global min/max stretch) treats a pixel the
 * same regardless of whether its surroundings are bright or dim, so regular-
 * weight text sitting in a slightly dimmer region of the photo can end up
 * barely distinguishable from its own local background even though bold
 * text elsewhere in the same photo reads fine. Verified case: a receipt
 * line's background measured ~100-150 luminance across most of its width
 * (a lighting gradient invisible to the eye at normal viewing size) while
 * the "white" background elsewhere in the same photo measured 220+; a
 * global threshold that worked for one broke the other. Comparing each
 * pixel to its own local neighborhood average handles both at once.
 *
 * The local average is computed via a summed-area table (integral image),
 * giving an O(1) box-sum per pixel regardless of window size, so this stays
 * fast on a full-resolution photo.
 */
function applyAdaptiveThreshold(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;

  const luminance = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    luminance[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Integral image with a 1px zero border (top/left) for simple box-sum math.
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += luminance[y * width + x];
      integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + rowSum;
    }
  }

  // Window scaled to image size (rather than a fixed pixel radius) so
  // "local" stays roughly the same relative scale - about text-line height -
  // regardless of the photo's resolution.
  const radius = Math.max(20, Math.round(width / 40));
  // How far below its local average a pixel must be to count as ink. Text
  // strokes are reliably well below their surroundings; JPEG noise and mild
  // shading aren't.
  const OFFSET = 15;

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const sum =
        integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0];
      const count = (x1 - x0) * (y1 - y0);
      const localMean = sum / count;

      const p = y * width + x;
      const value = luminance[p] < localMean - OFFSET ? 0 : 255;
      const i = p * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
    }
  }

  return imageData;
}

export interface PreprocessResult {
  /** Full-resolution, cropped and contrast-enhanced canvas, ready for OCR. */
  canvas: HTMLCanvasElement;
  imageDataUrl: string;
  thumbnailDataUrl: string;
}

/**
 * Applies deskew, auto-crop, grayscale conversion and contrast stretching.
 * This is a lightweight Canvas-based pipeline, not a full computer-vision
 * pipeline: EXIF-based auto-rotation is exact and deskew (detectSkewAngle)
 * straightens whatever rotation the whole frame has; auto-crop
 * (autoCropBounds) isolates the largest dense content block rather than
 * just bounding-boxing every dark pixel, so a document photographed
 * alongside other papers or handwriting is usually cropped to itself
 * instead of the whole cluttered frame. Still no true perspective
 * correction, and clutter directly touching the document's own edge still
 * gets pulled in with it - a document photographed at a steep angle (not
 * just rotated flat-on) also isn't corrected. See README.md for how to
 * swap in OpenCV.js for a more advanced pipeline (contour detection +
 * perspective warp).
 */
// Small/faint text (e.g. secondary UI text on a downscaled phone
// screenshot) is easy for OCR to miss when the source image itself is
// low-resolution. Upscaling toward this minimum width before OCR gives
// Tesseract more pixels per character to work with.
const MIN_OCR_WIDTH = 1600;

// No maximum width here: Tesseract runs in-browser with no memory ceiling,
// and downscaling a high-resolution phone photo throws away exactly the
// pixel detail small text needs.

export async function preprocessImage(file: File): Promise<PreprocessResult> {
  const loadedCanvas = await loadFileToCanvas(file);
  const skewAngle = detectSkewAngle(loadedCanvas);
  const sourceCanvas = rotateCanvas(loadedCanvas, skewAngle);
  const ctx = sourceCanvas.getContext('2d')!;
  const bounds = autoCropBounds(ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height));

  let cropped = document.createElement('canvas');
  cropped.width = Math.max(1, bounds.width);
  cropped.height = Math.max(1, bounds.height);
  let croppedCtx = cropped.getContext('2d')!;
  croppedCtx.drawImage(sourceCanvas, bounds.x, bounds.y, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);

  if (cropped.width < MIN_OCR_WIDTH) {
    const scale = MIN_OCR_WIDTH / cropped.width;
    const upscaled = document.createElement('canvas');
    upscaled.width = Math.round(cropped.width * scale);
    upscaled.height = Math.round(cropped.height * scale);
    const upscaledCtx = upscaled.getContext('2d')!;
    upscaledCtx.imageSmoothingEnabled = true;
    upscaledCtx.imageSmoothingQuality = 'high';
    upscaledCtx.drawImage(cropped, 0, 0, upscaled.width, upscaled.height);
    cropped = upscaled;
    croppedCtx = upscaledCtx;
  }

  const enhancedData = applyAdaptiveThreshold(croppedCtx.getImageData(0, 0, cropped.width, cropped.height));
  croppedCtx.putImageData(enhancedData, 0, 0);

  const thumbnail = document.createElement('canvas');
  const thumbScale = Math.min(1, 320 / cropped.width);
  thumbnail.width = Math.max(1, Math.round(cropped.width * thumbScale));
  thumbnail.height = Math.max(1, Math.round(cropped.height * thumbScale));
  thumbnail.getContext('2d')!.drawImage(cropped, 0, 0, thumbnail.width, thumbnail.height);

  return {
    canvas: cropped,
    imageDataUrl: cropped.toDataURL('image/jpeg', 0.9),
    thumbnailDataUrl: thumbnail.toDataURL('image/jpeg', 0.8),
  };
}
