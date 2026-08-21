import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { SignJWT } from "jose";

function createContext(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any,
    res: {} as any,
  };
}

async function clientSession(bookingId: string) {
  return new SignJWT({ type: "client_portal", bookingId, email: "c@c.com", clientName: "C" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("bob-cranes-client-portal")
    .setAudience("bob-cranes-client-portal")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || "bob-cranes-dev-secret"));
}

describe("Client portal security", () => {
  describe("endpoint protection", () => {
    it("generateMagicLink rejects unauthenticated users", async () => {
      const anon = appRouter.createCaller(createContext(null));
      await expect(anon.clientPortal.generateMagicLink({ bookingId: "BK-1", email: "x@x.com" }))
        .rejects.toThrow();
    });

    it("generateMagicLink rejects regular users", async () => {
      const regular = appRouter.createCaller(createContext({
        id: 1, openId: "t", email: "t@t.com", name: "T",
        loginMethod: "local", role: "user", departmentCode: "sales",
        createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), isActive: 1,
      } as any));
      await expect(regular.clientPortal.generateMagicLink({ bookingId: "BK-1", email: "x@x.com" }))
        .rejects.toThrow();
    });
  });

  describe("JWT validation and scope enforcement", () => {
    it("data endpoint rejects empty clientSession", async () => {
      const caller = appRouter.createCaller(createContext());
      await expect(caller.clientPortal.getBookingSummary({ bookingId: "BK-1", clientSession: "" }))
        .rejects.toThrow();
    });

    it("data endpoint rejects malformed JWT", async () => {
      const caller = appRouter.createCaller(createContext());
      await expect(caller.clientPortal.getBookingSummary({ bookingId: "BK-1", clientSession: "not-a-jwt" }))
        .rejects.toThrow("Access denied");
    });

    it("data endpoint rejects JWT signed with wrong key", async () => {
      const bad = await new SignJWT({ type: "client_portal", bookingId: "BK-1", email: "x@x.com", clientName: "X" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("bob-cranes-client-portal")
        .setAudience("bob-cranes-client-portal")
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(new TextEncoder().encode("wrong-key"));
      const caller = appRouter.createCaller(createContext());
      await expect(caller.clientPortal.getBookingSummary({ bookingId: "BK-1", clientSession: bad }))
        .rejects.toThrow("Access denied");
    });

    it("data endpoint rejects session for a different booking", async () => {
      const session = await clientSession("BK-OTHER");
      const caller = appRouter.createCaller(createContext());
      await expect(caller.clientPortal.getBookingSummary({ bookingId: "BK-1", clientSession: session }))
        .rejects.toThrow("Access denied");
    });

    it("getDocuments enforces same booking scope", async () => {
      const session = await clientSession("BK-OTHER");
      const caller = appRouter.createCaller(createContext());
      await expect(caller.clientPortal.getDocuments({ bookingId: "BK-1", clientSession: session }))
        .rejects.toThrow("Access denied");
    });
  });

  describe("input validation", () => {
    it("sendChatMessage rejects empty body", async () => {
      const session = await clientSession("BK-1");
      const caller = appRouter.createCaller(createContext());
      await expect(caller.clientPortal.sendChatMessage({ bookingId: "BK-1", clientSession: session, body: "" }))
        .rejects.toThrow();
    });
  });
});
