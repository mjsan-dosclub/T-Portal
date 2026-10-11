import "server-only";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

// otplib v13 functional API (checked against node_modules/otplib/dist/functional.d.ts and
// @otplib/totp types). epochTolerance 30 s ≈ ±1 step of 30 s (FR-AUTH-3); afterTimeStep blocks replay (AUTH-06).
const TOLERANCE_SECONDS = 30;

export function newTotpSecret(): string {
  return generateSecret();
}

export async function totpQr(secret: string, accountLabel: string) {
  const uri = generateURI({ issuer: "DOS Club Talent Portal", label: accountLabel, secret });
  const dataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { uri, dataUrl };
}

export type TotpCheck = { ok: true; step: number } | { ok: false };

export async function checkTotp(secret: string, token: string, lastStep: number | null, epochSeconds?: number): Promise<TotpCheck> {
  const clean = String(token ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return { ok: false };
  try {
    const r = await verify({
      secret,
      token: clean,
      epochTolerance: TOLERANCE_SECONDS,
      ...(epochSeconds !== undefined ? { epoch: epochSeconds } : {}),
      ...(lastStep !== null ? { afterTimeStep: lastStep } : {}),
    });
    // The functional verify() returns a TOTP|HOTP union; TOTP results carry timeStep.
    return r.valid && "timeStep" in r && typeof r.timeStep === "number" ? { ok: true, step: r.timeStep } : { ok: false };
  } catch {
    return { ok: false };
  }
}
