import { describe, expect, it } from "vitest";

import {
  createMessage,
  isWsMessage,
  parseMessage,
  serializeMessage,
} from "@/modules/realtime/protocol";

describe("realtime/protocol", () => {
  it("createMessage() stamps a fresh id and timestamp", () => {
    const msg = createMessage("entity.created", { id: "abc" });
    expect(msg.type).toBe("entity.created");
    expect(typeof msg.id).toBe("string");
    expect(msg.id.length).toBeGreaterThan(10);
    expect(typeof msg.ts).toBe("number");
    expect(msg.ts).toBeLessThanOrEqual(Date.now());
    expect(msg.payload).toEqual({ id: "abc" });
  });

  it("isWsMessage() accepts a well-formed envelope", () => {
    const ok = { type: "x", id: "y", ts: 1, payload: null };
    expect(isWsMessage(ok)).toBe(true);
  });

  it("isWsMessage() rejects malformed shapes", () => {
    expect(isWsMessage(null)).toBe(false);
    expect(isWsMessage(undefined)).toBe(false);
    expect(isWsMessage("string")).toBe(false);
    expect(isWsMessage({})).toBe(false);
    expect(isWsMessage({ type: 1, id: "y", ts: 1, payload: {} })).toBe(false);
    expect(isWsMessage({ type: "x", ts: 1, payload: {} })).toBe(false); // no id
  });

  it("serializeMessage / parseMessage round-trip", () => {
    const original = createMessage("telemetry.update", { foo: 1, bar: "two" });
    const wire = serializeMessage(original);
    const parsed = parseMessage(wire);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("telemetry.update");
    expect(parsed?.id).toBe(original.id);
    expect(parsed?.payload).toEqual({ foo: 1, bar: "two" });
  });

  it("parseMessage() returns null on garbage input", () => {
    expect(parseMessage("not json")).toBeNull();
    expect(parseMessage("{}")).toBeNull();
    expect(parseMessage('{"hello":"world"}')).toBeNull();
  });
});
