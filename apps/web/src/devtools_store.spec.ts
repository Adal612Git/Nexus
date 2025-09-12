import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { useCardsStore } from "./stores/cards";

describe("DevTools window.$pinia", () => {
  beforeEach(() => {
    // Ensure a root element exists for mounting
    const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "http://localhost:5173/" });
    // @ts-ignore
    global.window = dom.window as any;
    // @ts-ignore
    global.document = dom.window.document as any;
    // Pretend we are in dev mode
    // @ts-ignore
    import.meta.env = { DEV: true } as any;
  });

  it("exposes pinia stores map and cards store is accessible", async () => {
    await import("./main");
    // @ts-ignore
    const piniaMap: Map<string, any> = (window as any).$pinia;
    expect(piniaMap).toBeTruthy();
    // Instantiate the cards store to ensure it is registered
    const cards = useCardsStore();
    const instance = piniaMap.get("cards");
    expect(instance).toBeTruthy();
    expect(instance).toBe(cards);
  });
});
