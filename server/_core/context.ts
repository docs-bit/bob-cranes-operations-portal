import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserById } from "../db";
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

  const localUserId = await readLocalSession(opts.req.headers.cookie);
  if (localUserId) {
    const localUser = await getUserById(localUserId);
    if (localUser && localUser.isActive === 1) user = localUser;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
