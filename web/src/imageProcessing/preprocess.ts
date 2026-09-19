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

/** Simple content bounding box via row/column luminance projection, with padding. */
function autoCropBounds(imageData: ImageData): { x: number; y: number; width: number; height: number } {
  const { data, width, height } = imageData;
  const rowHasContent = new Array(height).fill(false);
  const colHasContent = new Array(width).fill(false);

  // Background is assumed light; anything sufficiently dark counts as content.
  const DARK_THRESHOLD = 235;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (luminance < DARK_THRESHOLD) {
        rowHasContent[y] = true;
        colHasContent[x] = true;
      }
    }
  }

  const firstRow = rowHasContent.indexOf(true);
  const lastRow = rowHasContent.lastIndexOf(true);
  const firstCol = colHasContent.indexOf(true);
  const lastCol = colHasContent.lastIndexOf(true);

  if (firstRow === -1 || firstCol === -1) {
    return { x: 0, y: 0, width, height };
  }

  const padX = Math.round(width * 0.02);
  const padY = Math.round(height * 0.02);

  const x = Math.max(0, firstCol - padX);
  const y = Math.max(0, firstRow - padY);
  const cropWidth = Math.min(width, lastCol + padX) - x;
  const cropHeight = Math.min(height, lastRow + padY) - y;

  return { x, y, width: cropWidth, height: cropHeight };
}

function applyGrayscaleAndContrast(imageData: ImageData): ImageData {
  const { data } = imageData;

  // Histogram-stretch contrast: map the observed [min, max] luminance range to
  // [0, 255] so faint pen/thermal-print text becomes easier for OCR to read.
  let min = 255;
  let max = 0;
  const luminances = new Float32Array(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    luminances[p] = l;
    if (l < min) min = l;
    if (l > max) max = l;
  }

  const range = Math.max(1, max - min);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const stretched = ((luminances[p] - min) / range) * 255;
    data[i] = data[i + 1] = data[i + 2] = stretched;
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
 * Applies auto-crop, grayscale conversion and contrast stretching. This is a
 * lightweight Canvas-based pipeline, not a full computer-vision pipeline:
 * EXIF-based auto-rotation is exact, but the crop is a plain content
 * bounding box (not perspective-corrected) and there is no true deskew. See
 * README.md for how to swap in OpenCV.js for a more advanced pipeline.
 */
// Small/faint text (e.g. secondary UI text on a downscaled phone
// screenshot) is easy for OCR to miss when the source image itself is
// low-resolution. Upscaling toward this minimum width before OCR gives
// Tesseract more pixels per character to work with.
const MIN_OCR_WIDTH = 1600;

export async function preprocessImage(file: File): Promise<PreprocessResult> {
  const sourceCanvas = await loadFileToCanvas(file);
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

  const enhancedData = applyGrayscaleAndContrast(croppedCtx.getImageData(0, 0, cropped.width, cropped.height));
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
