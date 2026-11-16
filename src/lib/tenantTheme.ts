/**
 * Dynamic Tenant Branding & White-Label Theming Engine
 * Applies tenant custom colors (primary/secondary) and branding assets to the DOM.
 */

export interface TenantBranding {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'trial' | 'archived';
}

/**
 * Converts a hex color string (#RRGGBB or #RGB) into space-separated HSL values "H S% L%"
 * matching Tailwind CSS variables.
 */
export function hexToHsl(hex: string): string | null {
  let cleanHex = hex.trim().replace(/^#/, '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  if (cleanHex.length !== 6) return null;

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = Math.round(h * 60);
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Normalizes any color representation (Hex, CSS hsl(...), or raw "H S% L%")
 * into the required Tailwind CSS variable format "H S% L%".
 */
export function normalizeHsl(colorStr: string): string {
  if (!colorStr) return '';
  const trimmed = colorStr.trim();

  // If it's a hex code
  if (trimmed.startsWith('#') || /^[0-9A-Fa-f]{6}$/.test(trimmed)) {
    const converted = hexToHsl(trimmed);
    if (converted) return converted;
  }

  // If it's formatted as hsl(h, s%, l%)
  const hslMatch = trimmed.match(/hsl\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/i);
  if (hslMatch) {
    return `${Math.round(Number(hslMatch[1]))} ${Math.round(Number(hslMatch[2]))}% ${Math.round(Number(hslMatch[3]))}%`;
  }

  // If already space-separated HSL values
  return trimmed;
}

/**
 * Applies tenant branding properties (CSS variables, Document Title, Favicon)
 * dynamically to the document root.
 */
export function applyTenantTheme(branding: Partial<TenantBranding> | null) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (branding?.primaryColor) {
    const primaryHsl = normalizeHsl(branding.primaryColor);
    if (primaryHsl) {
      root.style.setProperty('--primary', primaryHsl);
      root.style.setProperty('--sidebar-primary', primaryHsl);
      root.style.setProperty('--ring', primaryHsl);
      root.style.setProperty('--accent', primaryHsl);
    }
  }

  if (branding?.secondaryColor) {
    const secondaryHsl = normalizeHsl(branding.secondaryColor);
    if (secondaryHsl) {
      root.style.setProperty('--secondary', secondaryHsl);
      root.style.setProperty('--sidebar-accent', secondaryHsl);
    }
  }

  if (branding?.appName) {
    document.title = branding.appName;
  }

  if (branding?.faviconUrl) {
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'shortcut icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = branding.faviconUrl;
  }
}

