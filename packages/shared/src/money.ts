/** SAR amount (max two decimals) to integer halalas. */
export const toMinor = (sar: number): number => Math.round(sar * 100);

export const formatSar = (minor: number): string =>
  new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(minor / 100);
