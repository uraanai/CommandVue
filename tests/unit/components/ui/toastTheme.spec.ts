import { describe, expect, it } from "vitest";

import { toastMessageClass } from "@/components/ui/toastTheme";

/**
 * The toast severity → class mapping (Track A A1b). Asserts each PrimeVue
 * severity paints from its `--color-toast-*` / `--color-status-*` family tokens
 * and that unrecognized severities fall back to the neutral toast — all without
 * a single raw color literal (which the single-source guard also enforces).
 */
describe("toastMessageClass", () => {
  it("maps each known severity to its family tokens + accent stripe", () => {
    const cases: Array<[string, string, string]> = [
      ["success", "--color-toast-success-bg", "--color-status-success-border"],
      ["info", "--color-toast-info-bg", "--color-status-info-border"],
      ["warn", "--color-toast-warning-bg", "--color-status-warning-border"],
      ["error", "--color-toast-danger-bg", "--color-status-danger-border"],
    ];
    for (const [severity, bgToken, stripeToken] of cases) {
      const cls = toastMessageClass(severity);
      expect(cls, `${severity} fill`).toContain(bgToken);
      expect(cls, `${severity} stripe`).toContain(stripeToken);
    }
  });

  it("uses the warning/danger token families for warn/error (PrimeVue naming)", () => {
    expect(toastMessageClass("warn")).toContain("--color-toast-warning-fg");
    expect(toastMessageClass("error")).toContain("--color-toast-danger-fg");
  });

  it("falls back to the neutral toast for unknown / absent severities", () => {
    for (const sev of [undefined, "", "secondary", "contrast", "nonsense"]) {
      const cls = toastMessageClass(sev);
      expect(cls, `${String(sev)} → neutral`).toContain("--color-toast-bg");
      expect(cls).toContain("--color-toast-fg");
      // never leaks a per-severity family token
      expect(cls).not.toContain("--color-toast-success-bg");
      expect(cls).not.toContain("--color-toast-danger-bg");
    }
  });

  it("always carries the shared base layout classes + a left stripe", () => {
    const cls = toastMessageClass("success");
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("border-l-4");
    expect(cls).toContain("shadow-lg");
  });

  it("references only token variables — no raw color literals", () => {
    for (const sev of ["success", "info", "warn", "error", undefined]) {
      const cls = toastMessageClass(sev);
      expect(cls).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(cls).not.toMatch(/\b(?:rgb|rgba|hsl|oklch)\(/);
    }
  });
});
