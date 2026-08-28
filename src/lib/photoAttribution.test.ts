import { describe, it, expect } from "vitest";
import { mergeAttribution, removeAttribution } from "./photoAttribution";

describe("mergeAttribution", () => {
  it("returns the new line when there's nothing existing", () => {
    expect(mergeAttribution(null, "Photos via Google — Jane")).toBe("Photos via Google — Jane");
    expect(mergeAttribution("", "Photos via Google — Jane")).toBe("Photos via Google — Jane");
  });

  it("appends a second source alongside the first", () => {
    expect(mergeAttribution("Photos via Google — Jane", "Photos via Pexels — Sam")).toBe(
      "Photos via Google — Jane  ·  Photos via Pexels — Sam"
    );
  });

  it("replaces the segment for the same source, keeping the other", () => {
    const start = "Photos via Google — Jane  ·  Photos via Pexels — Sam";
    expect(mergeAttribution(start, "Photos via Pexels — Kim, Lee")).toBe(
      "Photos via Google — Jane  ·  Photos via Pexels — Kim, Lee"
    );
  });
});

describe("removeAttribution", () => {
  it("drops one source's segment and keeps the rest", () => {
    const start = "Photos via Google — Jane  ·  Photos via Pexels — Sam";
    expect(removeAttribution(start, "Photos via Pexels")).toBe("Photos via Google — Jane");
  });

  it("returns null when nothing is left", () => {
    expect(removeAttribution("Photos via Pexels — Sam", "Photos via Pexels")).toBeNull();
    expect(removeAttribution(null, "Photos via Google")).toBeNull();
  });
});
