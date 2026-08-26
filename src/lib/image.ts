export const MAX_IMAGE_DIMENSION = 1280;
export const JPEG_QUALITY = 0.82;
/** Tem de ficar abaixo do limite do servidor (3 MB depois de descodificar). */
export const MAX_UPLOAD_BYTES = 2.5 * 1024 * 1024;

export class ImageTooLargeError extends Error {
  constructor() {
    super("A imagem é demasiado grande, mesmo depois de reduzida");
    this.name = "ImageTooLargeError";
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem"));
    };
    image.src = url;
  });
}

function approximateBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Reduz a imagem no browser antes de a enviar.
 *
 * É isto que evita precisar de `sharp` no servidor: a fotografia de 8 MP do
 * telemóvel chega ao backend já com 1280px e uns 300 KB. Menos dependências,
 * upload mais rápido, e o servidor continua a validar o que recebe.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxDimension = MAX_IMAGE_DIMENSION,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Escolhe um ficheiro de imagem");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("O browser não suporta o redimensionamento de imagens");

  context.drawImage(image, 0, 0, width, height);

  let quality = JPEG_QUALITY;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  // Se ainda assim ficar grande (fotos muito detalhadas), baixa a qualidade.
  while (approximateBytes(dataUrl) > MAX_UPLOAD_BYTES && quality > 0.4) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (approximateBytes(dataUrl) > MAX_UPLOAD_BYTES) {
    throw new ImageTooLargeError();
  }

  return dataUrl;
}
