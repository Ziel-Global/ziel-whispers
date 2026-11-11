import { describe, it, expect, beforeEach } from "vitest";
import { hexToHsl, normalizeHsl, applyTenantTheme } from "../tenantTheme";

describe("Tenant Theming & White-Label Utilities", () => {
  beforeEach(() => {
    document.title = "Default Title";
    document.documentElement.style.removeProperty("--primary");
    document.documentElement.style.removeProperty("--secondary");
  });

  it("converts hex colors to Tailwind-compatible space-separated HSL strings", () => {
    // Ziel Orange #EB5A1E -> approx 18 84% 52%
    const hsl = hexToHsl("#EB5A1E");
    expect(hsl).toBeTruthy();
    expect(hsl).toMatch(/^\d+\s+\d+%\s+\d+%$/);

    // Pure Red #FF0000 -> 0 100% 50%
    expect(hexToHsl("#FF0000")).toBe("0 100% 50%");

    // Pure Green #00FF00 -> 120 100% 50%
    expect(hexToHsl("#00FF00")).toBe("120 100% 50%");

    // Short hex #FFF
    expect(hexToHsl("#FFF")).toBe("0 0% 100%");
  });

  it("normalizes various color inputs into HSL", () => {
    // Already formatted HSL
    expect(normalizeHsl("17 84% 52%")).toBe("17 84% 52%");

    // CSS hsl() format
    expect(normalizeHsl("hsl(17, 84%, 52%)")).toBe("17 84% 52%");

    // Hex format
    const fromHex = normalizeHsl("#FF0000");
    expect(fromHex).toBe("0 100% 50%");
  });

  it("applies theme styles to document root and updates title", () => {
    applyTenantTheme({
      appName: "Acme Corp Portal",
      primaryColor: "217 91% 60%",
      secondaryColor: "214 32% 96%",
    });

    expect(document.title).toBe("Acme Corp Portal");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("217 91% 60%");
    expect(document.documentElement.style.getPropertyValue("--sidebar-primary")).toBe("217 91% 60%");
    expect(document.documentElement.style.getPropertyValue("--secondary")).toBe("214 32% 96%");
  });
});

