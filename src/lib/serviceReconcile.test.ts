import { describe, it, expect } from "vitest";
import { reconcileServices } from "./serviceReconcile";

describe("reconcileServices", () => {
  it("creates rows when there's nothing existing", () => {
    const r = reconcileServices([], [{ name: "Classic set" }, { name: "Volume set", price: "$120" }]);
    expect(r.update).toEqual([]);
    expect(r.deleteIds).toEqual([]);
    expect(r.create.map((c) => [c.slug, c.name, c.price, c.order])).toEqual([
      ["classic-set", "Classic set", null, 0],
      ["volume-set", "Volume set", "$120", 1],
    ]);
  });

  it("matches by slug and keeps the existing id + image on rename-free edits", () => {
    const existing = [{ id: "svc_1", slug: "classic-set", imageUrl: "/uploads/a.webp" }];
    const r = reconcileServices(existing, [{ name: "Classic set", price: "$95" }]);
    expect(r.create).toEqual([]);
    expect(r.deleteIds).toEqual([]);
    expect(r.update).toEqual([
      {
        id: "svc_1",
        data: { slug: "classic-set", name: "Classic set", description: null, price: "$95", imageUrl: "/uploads/a.webp", order: 0 },
      },
    ]);
  });

  it("deletes existing rows whose slug is gone", () => {
    const existing = [
      { id: "svc_1", slug: "classic-set", imageUrl: null },
      { id: "svc_2", slug: "old-thing", imageUrl: null },
    ];
    const r = reconcileServices(existing, [{ name: "Classic set" }]);
    expect(r.deleteIds).toEqual(["svc_2"]);
    expect(r.update.map((u) => u.id)).toEqual(["svc_1"]);
  });

  it("treats a rename as delete-old + create-new (slug changed)", () => {
    const existing = [{ id: "svc_1", slug: "classic-set", imageUrl: "/uploads/a.webp" }];
    const r = reconcileServices(existing, [{ name: "Signature set" }]);
    expect(r.deleteIds).toEqual(["svc_1"]);
    expect(r.create.map((c) => c.slug)).toEqual(["signature-set"]);
  });

  it("explicitly clears an image when imageUrl is null, keeps it when omitted", () => {
    const existing = [
      { id: "svc_1", slug: "a", imageUrl: "/x.webp" },
      { id: "svc_2", slug: "b", imageUrl: "/y.webp" },
    ];
    const r = reconcileServices(existing, [
      { name: "A", imageUrl: null },
      { name: "B" },
    ]);
    const byId = Object.fromEntries(r.update.map((u) => [u.id, u.data.imageUrl]));
    expect(byId.svc_1).toBeNull();
    expect(byId.svc_2).toBe("/y.webp");
  });

  it("dedupes colliding slugs within the batch", () => {
    const r = reconcileServices([], [{ name: "Fill" }, { name: "Fill" }]);
    expect(r.create.map((c) => c.slug)).toEqual(["fill", "fill-2"]);
  });

  it("drops blank-name rows", () => {
    const r = reconcileServices([], [{ name: "  " }, { name: "Real" }]);
    expect(r.create.map((c) => c.name)).toEqual(["Real"]);
  });

  it("resequences order to the incoming order", () => {
    const existing = [
      { id: "svc_1", slug: "a", imageUrl: null },
      { id: "svc_2", slug: "b", imageUrl: null },
    ];
    const r = reconcileServices(existing, [{ name: "B" }, { name: "A" }]);
    const order = Object.fromEntries(r.update.map((u) => [u.data.slug, u.data.order]));
    expect(order).toEqual({ b: 0, a: 1 });
  });
});
