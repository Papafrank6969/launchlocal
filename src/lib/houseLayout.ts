import type { AgentStatus } from "./agentTypes";

// Where each brother lives on Frank's house model (public/house/house-final.glb)
// and how his window looks. Pure, so it's tested without WebGL.
// Coordinates are model units (meters), measured by orbiting the scene.

export type RoomSpec = {
  label: string;
  position: [number, number, number]; // center of the glow panel
  size: [number, number]; // panel width × height
  facing: number; // yaw in radians; 0 faces +Z (the street)
};

// ponytail: hand-measured on this one model by raycasting its front (building
// x≈1–16.5; main front z≈-4.5 with glass at x 8–10; left section recessed to
// z≈-10.5 for x 2–5; floors y 2.5–6, 6.5–10.5, 11–15). Panels sit 0.2 in front
// of the surface; two rooms per floor so name tags don't overlap. Re-measure if
// the model changes.
const FRONT = -4.3;
const RECESS = -10.3;

export const ROOMS: Record<string, RoomSpec> = {
  scout: { label: "Top floor", position: [9, 13, FRONT], size: [1.8, 1.8], facing: 0 },
  "rush-chair": { label: "Front entrance", position: [13.5, 4, FRONT], size: [1.8, 2.4], facing: 0 },
  "follow-up": { label: "Second-floor bedroom", position: [14.5, 8.5, FRONT], size: [1.8, 1.8], facing: 0 },
  builder: { label: "Workshop", position: [9, 4, FRONT], size: [1.8, 2.2], facing: 0 },
  treasurer: { label: "Top-floor office", position: [14.5, 13, FRONT], size: [1.8, 1.8], facing: 0 },
  pledge: { label: "Second-floor window", position: [9, 8.5, FRONT], size: [1.6, 1.8], facing: 0 },
};

// Brothers without a mapped room take these, in id order.
export const OVERFLOW: RoomSpec[] = [
  { label: "Spare room 1", position: [3.5, 13, RECESS], size: [2.4, 1.8], facing: 0 },
  { label: "Spare room 2", position: [3.5, 4, RECESS], size: [2.4, 2.2], facing: 0 },
  { label: "Spare room 3", position: [3.5, 8.5, RECESS], size: [2.4, 1.8], facing: 0 },
  { label: "Spare room 4", position: [6.5, 13, -6.3], size: [1.4, 1.8], facing: 0 },
];

export const PALETTE = {
  sky: "#0b1020",
  ground: "#1f3320",
  pad: "#9a9a95",
  street: "#2b2d31",
  dash: "#d9d4b8",
  curb: "#b5b5ae",
  idle: "#ffcf7a",
  running: "#fff2c2",
  error: "#ff4d4d",
  off: "#1b1f2a",
};

/** Mapped brothers get their room; the rest fill OVERFLOW in id order. Extra ones beyond OVERFLOW get no room. */
export function layoutRooms(ids: string[]): { id: string; room: RoomSpec }[] {
  const mapped = ids.filter((id) => ROOMS[id]).map((id) => ({ id, room: ROOMS[id] }));
  const unmapped = ids.filter((id) => !ROOMS[id]).sort();
  const overflow = unmapped.slice(0, OVERFLOW.length).map((id, i) => ({ id, room: OVERFLOW[i] }));
  return [...mapped, ...overflow];
}

/** Window color, glow strength (emissive intensity) and whether it pulses. */
export function roomLook(status: AgentStatus, reducedMotion: boolean): { window: string; glow: number; pulse: boolean } {
  switch (status) {
    case "RUNNING":
      return { window: PALETTE.running, glow: 2.5, pulse: !reducedMotion };
    case "ERROR":
      return { window: PALETTE.error, glow: 1.8, pulse: false };
    case "OFF":
      return { window: PALETTE.off, glow: 0, pulse: false };
    default:
      return { window: PALETTE.idle, glow: 1.2, pulse: false };
  }
}
