import type { AppShelfApi } from "../../preload";

declare global {
  interface Window {
    appShelf: AppShelfApi;
  }
}

export {};
