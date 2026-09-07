import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { parse } from "cookie";
import { jwtVerify, SignJWT } from "jose";
import type { User } from "../drizzle/schema";
import { LOCAL_AUTH_COOKIE_NAME } from "../shared/const";
import { ENV } from "./_core/env";

const scryptAsync = promisify(scrypt);
const SESSION_ISSUER = "bob-cranes-local-auth";
const SESSION_AUDIENCE = "bob-cranes-operations-portal";
const SESSION_LIFETIME = "12h";

function sessionKey() {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET must be configured before local password sign-in can be used.");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, saved] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !saved) return false;

  const expected = Buffer.from(saved, "base64url");
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function createLocalSession(user: User) {
  return new SignJWT({ type: "password" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(SESSION_LIFETIME)
    .sign(sessionKey());
}

export type LocalSession = {
  userId: number;
  jti: string;
  expiresAt: Date;
};

export async function readLocalSession(
  cookieHeader?: string
): Promise<LocalSession | undefined> {
  const token = cookieHeader ? parse(cookieHeader)[LOCAL_AUTH_COOKIE_NAME] : undefined;
  if (!token) return undefined;

  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) return undefined;
    if (typeof payload.jti !== "string" || !payload.jti) return undefined;
    const expiresAt =
      typeof payload.exp === "number"
        ? new Date(payload.exp * 1000)
        : new Date(Date.now() + 12 * 60 * 60 * 1000);
    return { userId, jti: payload.jti, expiresAt };
  } catch {
    return undefined;
  }
}

export function toSessionUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.localEmail ?? user.email,
    companyName: user.companyName,
    phone: user.phone,
    role: user.role,
    departmentCode: user.departmentCode,
    supervisorId: user.supervisorId,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword ?? 0,
    createdAt: user.createdAt,
    lastSignedIn: user.lastSignedIn,
  };
}
