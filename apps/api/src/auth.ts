import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import type { FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";
import { config } from "./config.js";
declare module "fastify" {
  interface FastifyRequest {
    authUser: {
      id: string;
      role: Role;
      name: string;
      email: string;
      profileName?: string;
      permissions?: string[];
    };
  }
}
export default fp(async (app) => {
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.secret,
    cookie: { cookieName: "qa_session", signed: false },
  });
  app.decorateRequest("authUser");
  app.decorate("authenticate", async (req: FastifyRequest) => {
    try {
      req.authUser = await req.jwtVerify();
    } catch {
      const e: any = new Error("Não autenticado");
      e.statusCode = 401;
      throw e;
    }
  });
});
export function allow(...roles: Role[]) {
  return async (req: FastifyRequest) => {
    const p = req.authUser.permissions;
    let required = "";
    if (roles.length === 1 && roles[0] === "ADMIN") required = "USERS_WRITE";
    else if (roles.includes("DEV")) required = "BUGS_WRITE";
    else if (roles.includes("QA")) required = "TESTS_WRITE";
    const granted = Array.isArray(p)
      ? p.includes(required) || p.includes("USERS_WRITE")
      : roles.includes(req.authUser.role);
    if (!granted) {
      const e: any = new Error("Você não tem permissão para esta ação");
      e.statusCode = 403;
      throw e;
    }
  };
}
