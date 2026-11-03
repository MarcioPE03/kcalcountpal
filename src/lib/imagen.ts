/** Compress an image in the browser: max side 1024px, JPEG, target < ~300 KB. */
export async function comprimirImagen(file: File | Blob): Promise<{ blob: Blob; dataUrl: string }> {
  const bitmap = await createImageBitmap(file).catch(async () => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  });
  const w0 = "width" in bitmap ? bitmap.width : 0;
  const h0 = "height" in bitmap ? bitmap.height : 0;
  let max = 1024;
  let quality = 0.8;
  for (let i = 0; i < 6; i++) {
    const scale = Math.min(1, max / Math.max(w0, h0));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w0 * scale);
    canvas.height = Math.round(h0 * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen");
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo comprimir"))), "image/jpeg", quality),
    );
    if (blob.size <= 300_000 || i === 5) {
      const dataUrl: string = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(blob);
      });
      return { blob, dataUrl };
    }
    quality = Math.max(0.5, quality - 0.1);
    max = Math.round(max * 0.85);
  }
  throw new Error("No se pudo comprimir");
}

export function blobABase64(blob: Blob): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.readAsDataURL(blob);
  });
}
