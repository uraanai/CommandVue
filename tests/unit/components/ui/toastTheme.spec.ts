import { describe, expect, it } from "vitest";

import { severityAccentClass, toPrimeSeverity } from "@/components/ui/toastTheme";

/**
 * The toast severity bridge + icon-accent mapping (Track A A-Toast). Asserts the
 * project↔PrimeVue severity rename and that each severity's icon paints from its
 * `--color-status-*` family token (themeable), with a neutral fallback — all
 * without a raw color literal (the single-source guard also enforces this).
 */
describe("toPrimeSeverity", () => {
  it("renames warning→warn and danger→error, passes the rest through", () => {
    expect(toPrimeSeverity("success")).toBe("success");
    expect(toPrimeSeverity("info")).toBe("info");
    expect(toPrimeSeverity("warning")).toBe("warn");
    expect(toPrimeSeverity("danger")).toBe("error");
  });
});

describe("severityAccentClass", () => {
  it("maps each PrimeVue severity to its status-family token color", () => {
    expect(severityAccentClass("success")).toContain("--color-status-success");
    expect(severityAccentClass("info")).toContain("--color-status-info");
    expect(severityAccentClass("warn")).toContain("--color-status-warning");
    expect(severityAccentClass("error")).toContain("--color-status-danger");
  });

  it("falls back to the neutral toast foreground for unknown severities", () => {
    for (const sev of [undefined, "", "secondary", "contrast", "nope"]) {
      expect(severityAccentClass(sev)).toContain("--color-toast-fg");
      expect(severityAccentClass(sev)).not.toContain("--color-status-");
    }
  });

  it("references only token variables — no raw color literals", () => {
    for (const sev of ["success", "info", "warn", "error", undefined]) {
      const cls = severityAccentClass(sev);
      expect(cls).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(cls).not.toMatch(/\b(?:rgb|rgba|hsl|oklch)\(/);
    }
  });
});
