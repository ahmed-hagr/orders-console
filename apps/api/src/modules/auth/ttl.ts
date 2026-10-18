const UNITS: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** "8h" -> milliseconds. Matches the subset of jsonwebtoken's expiresIn format we allow. */
export default function ms(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) throw new Error(`JWT_TTL must look like 30m, 8h or 1d (got "${ttl}")`);
  return Number(m[1]) * UNITS[m[2]!]!;
}
