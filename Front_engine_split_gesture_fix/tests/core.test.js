import { describe, expect, it, vi } from "vitest";
import { AirNoteApi, AirNoteApiError } from "../js/core/api.js";
import {
  clearLoginState,
  hasActiveLogin,
  saveLoginSession,
  startLocalGestureSession,
} from "../js/core/auth.js";
import { createPresentationStore } from "../js/core/store.js";
import { readJson, writeJson } from "../js/core/storage.js";
import { setModalOpen, showToast } from "../js/core/ui.js";

describe("core storage", () => {
  it("reads and writes JSON without changing legacy keys", () => {
    expect(writeJson(localStorage, "airnote.test", { value: 1 })).toBe(true);
    expect(readJson(localStorage, "airnote.test", null)).toEqual({ value: 1 });
  });

  it("returns fallback for corrupted JSON", () => {
    localStorage.setItem("airnote.test", "{");
    expect(readJson(localStorage, "airnote.test", [])).toEqual([]);
  });
});

describe("auth session", () => {
  it("stores only non-password current user data", () => {
    sessionStorage.setItem("airnoteLocalGestureMode", "true");
    saveLoginSession({ userId: 1, name: "Tester", email: "air@note", password: "secret" }, true);
    expect(hasActiveLogin()).toBe(true);
    expect(localStorage.getItem("airnoteCurrentUserPassword")).toBeNull();
    expect(localStorage.getItem("airnoteCurrentUserId")).toBe("1");
    expect(sessionStorage.getItem("airnoteLocalGestureMode")).toBeNull();
    expect(JSON.parse(localStorage.getItem("airnoteCurrentUser"))).toEqual({
      userId: 1,
      name: "Tester",
      email: "air@note",
    });
    clearLoginState();
    expect(hasActiveLogin()).toBe(false);
  });

  it("starts a local gesture session without a backend user id", () => {
    startLocalGestureSession();

    expect(hasActiveLogin()).toBe(true);
    expect(localStorage.getItem("airnoteCurrentUserId")).toBeNull();
    expect(sessionStorage.getItem("airnoteLocalGestureMode")).toBe("true");
    expect(JSON.parse(localStorage.getItem("airnoteCurrentUser"))).toEqual({
      userId: null,
      name: "로컬 제스처 테스트",
      email: "local-gesture@airnote.test",
    });

    clearLoginState();
    expect(sessionStorage.getItem("airnoteLocalGestureMode")).toBeNull();
  });
});

describe("backend API client", () => {
  it("posts JSON requests to the configured AirNote backend", async () => {
    window.AIRNOTE_API_BASE_URL = "http://example.test/AirNote_Backend";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { userId: 1, email: "air@note" },
    }), {
      headers: { "Content-Type": "application/json" },
    }));

    const response = await AirNoteApi.login({ email: "air@note", password: "secret" });

    expect(response.data.userId).toBe(1);
    expect(fetch).toHaveBeenCalledWith("http://example.test/AirNote_Backend/api/users/login", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "air@note", password: "secret" }),
    }));
    delete window.AIRNOTE_API_BASE_URL;
  });

  it("posts user calibration data as JSON", async () => {
    window.AIRNOTE_API_BASE_URL = "http://example.test/AirNote_Backend";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { calibrationId: 1 },
    }), {
      headers: { "Content-Type": "application/json" },
    }));

    await AirNoteApi.saveUserCalibration({ userId: 1, version: 2, palmSize: 0.12 });

    expect(fetch).toHaveBeenCalledWith("http://example.test/AirNote_Backend/api/users/calibration", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ userId: 1, version: 2, palmSize: 0.12 }),
    }));
    delete window.AIRNOTE_API_BASE_URL;
  });

  it("uses query parameters to end a presentation", async () => {
    window.AIRNOTE_API_BASE_URL = "http://example.test/AirNote_Backend";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      message: "ended",
      data: null,
    }), {
      headers: { "Content-Type": "application/json" },
    }));

    await AirNoteApi.endPresentation(12);

    expect(fetch).toHaveBeenCalledWith(
      "http://example.test/AirNote_Backend/api/presentations/end?presentationId=12",
      expect.objectContaining({ method: "POST" }),
    );
    delete window.AIRNOTE_API_BASE_URL;
  });

  it("posts annotations as URL encoded fields", async () => {
    window.AIRNOTE_API_BASE_URL = "http://example.test/AirNote_Backend";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { annotationId: 7 },
    }), {
      headers: { "Content-Type": "application/json" },
    }));

    await AirNoteApi.saveAnnotation({
      presentationId: 3,
      pageNo: 2,
      tool: "POINTER",
      source: "MANUAL",
    });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toContain("application/x-www-form-urlencoded");
    expect(options.body.get("presentationId")).toBe("3");
    expect(options.body.get("pageNo")).toBe("2");
    delete window.AIRNOTE_API_BASE_URL;
  });

  it("rejects invalid server IDs before sending a request", () => {
    globalThis.fetch = vi.fn();

    expect(() => AirNoteApi.getPresentationDetail(0)).toThrow(AirNoteApiError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("resolves backend image paths against the API origin", () => {
    window.AIRNOTE_API_BASE_URL = "http://api.example.test:8090/AirNote_Backend";

    expect(AirNoteApi.resolveAssetUrl("/AirNote_Backend/api/records/files/a.png"))
      .toBe("http://api.example.test:8090/AirNote_Backend/api/records/files/a.png");

    delete window.AIRNOTE_API_BASE_URL;
  });

  it("keeps proxied image paths on the frontend origin", () => {
    expect(AirNoteApi.resolveAssetUrl("/AirNote_Backend/api/records/files/a.png"))
      .toBe(`${window.location.origin}/AirNote_Backend/api/records/files/a.png`);
  });
});

describe("presentation store", () => {
  it("updates and notifies subscribers", () => {
    const store = createPresentationStore({ running: false });
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ running: true });
    expect(store.getState().running).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("shared UI helpers", () => {
  it("opens modal and shows toast without changing markup", () => {
    document.body.innerHTML = `
      <div id="modal" aria-hidden="true"><button>OK</button></div>
      <div id="toast"></div>
    `;
    const modal = document.getElementById("modal");
    const toast = document.getElementById("toast");
    setModalOpen(modal, true);
    showToast(toast, "Saved");
    expect(modal.classList.contains("show")).toBe(true);
    expect(modal.getAttribute("aria-hidden")).toBe("false");
    expect(toast.textContent).toBe("Saved");
    expect(toast.classList.contains("show")).toBe(true);
  });
});
