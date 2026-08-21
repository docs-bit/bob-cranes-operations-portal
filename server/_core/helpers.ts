import { LOCAL_AUTH_COOKIE_NAME, COOKIE_NAME } from "@shared/const";
import {
  canAccessDepartment,
  type DepartmentCode,
  type PortalRole,
} from "@shared/departmentAccess";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./cookies";
import * as db from "../db";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

export const accountInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(10).max(160),
  departmentCode: z.string().trim().min(3).max(16),
});

export const registrationInput = accountInput.extend({
  role: z.enum(["user", "supervisor"]).default("user"),
});

export const workflowChecklistInput = z.object({
  id: z.string().trim().min(2).max(64),
  label: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  required: z.boolean(),
  guidance: z.string().trim().min(2).max(600),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const localSessionMaxAge = 12 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Session Helpers
// ---------------------------------------------------------------------------

export function writeLocalSession(
  ctx: { req: any; res: any },
  token: string,
) {
  ctx.res.cookie(LOCAL_AUTH_COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: localSessionMaxAge,
  });
}

export function clearAuthCookies(ctx: { req: any; res: any }) {
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
  ctx.res.clearCookie(LOCAL_AUTH_COOKIE_NAME, cookieOptions);
}

// ---------------------------------------------------------------------------
// Access Control Helpers
// ---------------------------------------------------------------------------

export function requireDepartmentAccess(
  user: { role: PortalRole; departmentCode?: string | null },
  code: DepartmentCode,
) {
  if (!canAccessDepartment(user, code)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your department account cannot access this workspace.",
    });
  }
}

export function requireAccountManagementAccess(
  user: { role: PortalRole; departmentCode?: string | null },
  targetDepartment?: string | null,
) {
  if (user.role === "admin") return;
  if (
    user.role === "supervisor" &&
    user.departmentCode &&
    targetDepartment === user.departmentCode
  )
    return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      "Only an administrator or the department supervisor can manage this account.",
  });
}

export function requireDocumentTaxonomyManager(user: { role: PortalRole }) {
  if (user.role !== "admin" && user.role !== "supervisor") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Only supervisors and administrators can manage document categories and tags.",
    });
  }
}

export async function requireActiveProvisionedDepartment(code: string) {
  const dashboard = await db.getProvisionedDepartmentDashboard(code);
  if (!dashboard || dashboard.active !== 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Choose an active department dashboard before assigning access.",
    });
  }
  return dashboard;
}
