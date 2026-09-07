import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserById, isSessionRevoked } from "../db";
import { readLocalSession } from "../localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const session = await readLocalSession(opts.req.headers.cookie);
  if (session) {
    const revoked = await isSessionRevoked(session.jti).catch(() => false);
    if (!revoked) {
      const localUser = await getUserById(session.userId);
      if (localUser && localUser.isActive === 1) user = localUser;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
