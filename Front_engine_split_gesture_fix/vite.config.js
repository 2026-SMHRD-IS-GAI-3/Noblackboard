import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    rollupOptions: {
      input: {
        login: resolve("index.html"),
        home: resolve("pages/home.html"),
        mypage: resolve("pages/mypage.html"),
        presentation: resolve("pages/presentation.html"),
        signup: resolve("pages/signup.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    restoreMocks: true,
  },
});
