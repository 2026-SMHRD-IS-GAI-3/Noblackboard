export function createAnnotationEngine({ pdfCanvas, drawCanvas, pointerElement }) {
  const context = drawCanvas?.getContext?.("2d") || null;
  const annotationsByPage = new Map();

  function hasInk() {
    if (!drawCanvas || !context) return false;
    try {
      const data = context.getImageData(0, 0, drawCanvas.width, drawCanvas.height).data;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] !== 0) return true;
      }
    } catch (error) {
      console.warn("AirNote annotations: blank check failed.", error);
      return true;
    }
    return false;
  }

  function clearCanvasOnly() {
    if (context && drawCanvas) context.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  }

  return {
    clear() {
      clearCanvasOnly();
    },
    hasInk,
    savePage(pageNo) {
      if (!drawCanvas?.width || !drawCanvas?.height) return false;
      if (!hasInk()) {
        annotationsByPage.delete(pageNo);
        return false;
      }
      annotationsByPage.set(pageNo, {
        dataUrl: drawCanvas.toDataURL("image/png"),
        width: drawCanvas.width,
        height: drawCanvas.height,
      });
      return true;
    },
    restorePage(pageNo, { ImageCtor = globalThis.Image, onRestored } = {}) {
      clearCanvasOnly();
      const saved = annotationsByPage.get(pageNo);
      if (!saved || !drawCanvas || !context || !ImageCtor) {
        onRestored?.(false);
        return false;
      }
      const image = new ImageCtor();
      image.onload = () => {
        context.drawImage(image, 0, 0, saved.width, saved.height, 0, 0, drawCanvas.width, drawCanvas.height);
        onRestored?.(true);
      };
      image.src = saved.dataUrl;
      return true;
    },
    deletePage(pageNo) {
      return annotationsByPage.delete(pageNo);
    },
    reset() {
      annotationsByPage.clear();
      clearCanvasOnly();
    },
    count() {
      return Array.from(annotationsByPage.values()).filter((item) => item?.dataUrl).length;
    },
    entries() {
      return Array.from(annotationsByPage.entries());
    },
    movePointer(xRatio, yRatio) {
      if (!pointerElement || !drawCanvas) return;
      const rect = drawCanvas.getBoundingClientRect();
      pointerElement.style.left = `${xRatio * rect.width}px`;
      pointerElement.style.top = `${yRatio * rect.height}px`;
      pointerElement.style.opacity = "1";
    },
    getCanvases: () => ({ pdfCanvas, drawCanvas }),
    dispose() {
      annotationsByPage.clear();
      if (pointerElement) pointerElement.style.opacity = "0";
    },
  };
}
