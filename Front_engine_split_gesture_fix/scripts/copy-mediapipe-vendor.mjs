import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

function copyDirectory(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const sourcePath = join(from, entry.name);
    const targetPath = join(to, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, targetPath);
    else if (entry.isFile()) copyFileSync(sourcePath, targetPath);
  }
}

function copyPdfJsToVendor() {
  const pdfBuild = resolve("node_modules/pdfjs-dist/build");
  const pdfVendor = resolve("vendor/pdfjs");
  if (!existsSync(pdfBuild)) {
    console.warn("pdfjs-dist build directory not found; skipping PDF.js vendor copy.");
    return;
  }
  mkdirSync(pdfVendor, { recursive: true });
  for (const fileName of ["pdf.min.js", "pdf.worker.min.js"]) {
    const from = join(pdfBuild, fileName);
    if (existsSync(from)) copyFileSync(from, join(pdfVendor, fileName));
  }
  console.log("PDF.js vendor prepared at vendor/pdfjs.");
}

function copyMediaPipeToVendor() {
  const mediaPipeSource = resolve("node_modules/@mediapipe/tasks-vision");
  const mediaPipeVendor = resolve("vendor/mediapipe");
  if (!existsSync(mediaPipeSource)) {
    console.warn("@mediapipe/tasks-vision directory not found; skipping MediaPipe module vendor copy.");
    return;
  }
  mkdirSync(mediaPipeVendor, { recursive: true });
  const moduleFile = join(mediaPipeSource, "vision_bundle.mjs");
  if (existsSync(moduleFile)) copyFileSync(moduleFile, join(mediaPipeVendor, "vision_bundle.mjs"));
  const wasmSource = join(mediaPipeSource, "wasm");
  const wasmTarget = join(mediaPipeVendor, "wasm");
  if (existsSync(wasmSource)) copyDirectory(wasmSource, wasmTarget);
  console.log("MediaPipe runtime vendor prepared at vendor/mediapipe.");
}

function copyVendorDirectory(name) {
  const source = resolve(`vendor/${name}`);
  const target = resolve(`dist/vendor/${name}`);
  if (!existsSync(source)) {
    console.warn(`${name} vendor directory not found; skipping copy.`);
    return;
  }
  rmSync(target, { recursive: true, force: true });
  copyDirectory(source, target);
  console.log(`${name} vendor copied to dist/vendor/${name}.`);
}

copyMediaPipeToVendor();
copyPdfJsToVendor();
copyVendorDirectory("mediapipe");
copyVendorDirectory("pdfjs");
