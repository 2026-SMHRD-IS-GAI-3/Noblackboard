export function createAnnotationEngine({ pdfCanvas, drawCanvas, pointerElement }) {
  const context = drawCanvas?.getContext?.("2d") || null;
  const annotationsByPage = new Map();
  const pageSnapshots = new Map();

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

  // 저장용 페이지 이미지: PDF 페이지(배경) + 판서(오버레이)를 한 장으로 합성한다.
  // PDF가 없으면(또는 합성 불가 환경) 기존처럼 판서만 저장한다.
  function composePageImage() {
    if (!pdfCanvas?.width || !pdfCanvas?.height) {
      return drawCanvas.toDataURL("image/png");
    }
    try {
      const composite = (typeof document !== "undefined" && document.createElement)
        ? document.createElement("canvas")
        : null;
      const ctx = composite?.getContext?.("2d");
      if (!composite || !ctx) return drawCanvas.toDataURL("image/png");
      composite.width = drawCanvas.width;
      composite.height = drawCanvas.height;
      ctx.fillStyle = "#ffffff";                          // PDF 투명 영역 대비 흰 종이 배경
      ctx.fillRect(0, 0, composite.width, composite.height);
      ctx.drawImage(pdfCanvas, 0, 0, pdfCanvas.width, pdfCanvas.height, 0, 0, composite.width, composite.height);
      ctx.drawImage(drawCanvas, 0, 0, drawCanvas.width, drawCanvas.height, 0, 0, composite.width, composite.height);
      return composite.toDataURL("image/png");
    } catch (error) {
      console.warn("AirNote annotations: page composite failed; saving strokes only.", error);
      return drawCanvas.toDataURL("image/png");
    }
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
        dataUrl: composePageImage(),
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
      pageSnapshots.clear();
      clearCanvasOnly();
    },
    count() {
      return Array.from(annotationsByPage.values()).filter((item) => item?.dataUrl).length;
    },
    entries() {
      return Array.from(annotationsByPage.entries());
    },
    // PDF 배경 + 판서 합성본을 pageSnapshots에 저장 (잉크 유무 무관)
    snapshotPage(pageNo) {
      if (!drawCanvas?.width && !pdfCanvas?.width) return false;
      pageSnapshots.set(pageNo, {
        dataUrl: composePageImage(),
        width: drawCanvas?.width || pdfCanvas?.width || 0,
        height: drawCanvas?.height || pdfCanvas?.height || 0,
      });
      return true;
    },
    getSnapshots() {
      return Array.from(pageSnapshots.entries());
    },
    getCurrentPageImageDataUrl() {
      return composePageImage();
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
      pageSnapshots.clear();
      if (pointerElement) pointerElement.style.opacity = "0";
    },
  };
}
