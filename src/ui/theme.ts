/** Shared visual language for the command interface. */
export const THEME = {
  colors: {
    background: 0x070b0c,
    backgroundAlt: 0x0a1112,
    panel: 0x0c1416,
    panelRaised: 0x111a1c,
    panelDeep: 0x070d0e,
    line: 0x263435,
    lineBright: 0x445250,
    sand: 0xc9b389,
    sandBright: 0xe2ce9f,
    amber: 0xe0a64b,
    amberDim: 0x8c6a33,
    signal: 0x7fd8b2,
    signalDim: 0x3c7862,
    danger: 0xd06a52,
    dangerDim: 0x7c3c2f,
    white: 0xe6e1d3,
    muted: 0x8a948c,
    mutedDark: 0x5b6660,
    black: 0x000000,
    overlay: 0x020505,
    green: 0x7da67c,
    blue: 0x7ea6bb,
  },
  fonts: {
    display: 'Bahnschrift, "DIN Alternate", "Segoe UI", Arial, sans-serif',
    body: '"Segoe UI", Bahnschrift, Arial, sans-serif',
    mono: 'Consolas, "Courier New", monospace',
  },
  fontSizes: {
    micro: 10,
    tiny: 12,
    small: 14,
    body: 16,
    label: 18,
    heading: 24,
    title: 34,
    hero: 58,
  },
};

export function hexToCss(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

export const REGION_ACCENTS: Record<string, number> = {
  blackwood: 0x78a06b,
  dead_district: 0xa27c62,
  iron_fortress: 0x8e9a83,
  dust_valley: 0xc39a5b,
  zero_point: 0x8fb3c9,
};
