import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Role, ExecutionStatus, BugStatus } from "@prisma/client";
import { labels } from "@qa/shared";
import { loginSchema, testCaseSchema, executionSchema } from "./schemas.js";
import { config } from "./config.js";
import { db } from "./db.js";
import auth, { allow } from "./auth.js";

const app = Fastify({ logger: true });
fs.mkdirSync(config.uploadDir, { recursive: true });
const localOrigins = new Set([
  config.origin,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
await app.register(cors, {
  origin: (origin, callback) =>
    callback(null, !origin || localOrigins.has(origin)),
  credentials: true,
});
await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });
await app.register(rateLimit, { global: false });
await app.register(auth);
await app.register(fastifyStatic, {
  root: config.uploadDir,
  prefix: "/uploads/",
  setHeaders: (reply) => reply.header("X-Content-Type-Options", "nosniff"),
});
app.setErrorHandler((err: any, req, reply) => {
  const status = err.statusCode || (err.issues ? 400 : 500);
  req.log.error(err);
  reply.status(status).send({
    error: {
      code:
        status === 400
          ? "VALIDATION_ERROR"
          : status === 403
            ? "FORBIDDEN"
            : status === 429
              ? "TOO_MANY_ATTEMPTS"
              : "REQUEST_ERROR",
      message:
        status === 429
          ? "Muitas tentativas de login. Aguarde um minuto e tente novamente."
          : status === 500
            ? "Não foi possível concluir a operação"
            : err.message,
      details: err.issues,
    },
  });
});
const guard = { preHandler: (app as any).authenticate };
const secure = (roles: Role[]) => ({
  preHandler: [(app as any).authenticate, allow(...roles)],
});
const audit = (
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  details?: any,
) =>
  db.auditLog.create({ data: { actorId, action, entity, entityId, details } });

app.get("/health", async () => ({ status: "ok" }));
app.post(
  "/api/v1/auth/login",
  {
    config: {
      rateLimit: { max: 10, timeWindow: "1 minute" },
    },
  },
  async (req, reply) => {
  const input = loginSchema.parse(req.body);
  const user = await db.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { profile: true },
  });
  if (
    !user ||
    !user.active ||
    !(await bcrypt.compare(input.password, user.passwordHash))
  ) {
    const e: any = new Error("E-mail ou senha inválidos");
    e.statusCode = 401;
    throw e;
  }
  const payload = {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    profileName: user.profile?.name || user.role,
    permissions: (user.profile?.permissions as string[]) || undefined,
  };
  const token = app.jwt.sign(payload, { expiresIn: "8h" });
  reply.setCookie("qa_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: config.isProduction,
    maxAge: 28800,
  });
  return payload;
});
app.post("/api/v1/auth/logout", { ...guard }, async (_, reply) => {
  reply.clearCookie("qa_session", { path: "/" });
  return { ok: true };
});
app.get("/api/v1/auth/me", { ...guard }, async (req) => req.authUser);

app.get("/api/v1/users", secure([Role.ADMIN]), async () =>
  db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profileId: true,
      profile: { select: { name: true } },
      active: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  }),
);
app.post("/api/v1/users", secure([Role.ADMIN]), async (req: any) => {
  const { name, email, password, profileId } = req.body;
  const profile = await db.accessProfile.findUnique({
    where: { id: profileId },
  });
  if (!name || !email || !password || !profile)
    throw Object.assign(
      new Error("Preencha nome, e-mail, senha e perfil válidos"),
      { statusCode: 400 },
    );
  return db.user.create({
    data: {
      name,
      email: String(email).toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      role: profile.baseRole,
      profileId: profile.id,
    },
  });
});
app.patch("/api/v1/users/:id", secure([Role.ADMIN]), async (req: any) => {
  if (req.params.id === req.authUser.id && req.body.active === false)
    throw Object.assign(
      new Error("Você não pode desativar seu próprio usuário"),
      { statusCode: 400 },
    );
  const data: any = {};
  if (typeof req.body.active === "boolean") data.active = req.body.active;
  if (req.body.profileId) {
    const p = await db.accessProfile.findUniqueOrThrow({
      where: { id: req.body.profileId },
    });
    data.profileId = p.id;
    data.role = p.baseRole;
  }
  return db.user.update({ where: { id: req.params.id }, data });
});
app.delete("/api/v1/users/:id", secure([Role.ADMIN]), async (req: any) => {
  if (req.params.id === req.authUser.id)
    throw Object.assign(
      new Error(
        "Você não pode excluir seu próprio usuário enquanto está conectado",
      ),
      { statusCode: 400 },
    );
  const executions = await db.execution.findMany({
    where: { executorId: req.params.id },
    include: { evidences: true, bug: { include: { evidences: true } } },
  });
  const executionIds = executions.map((item) => item.id);
  const bugs = executions.flatMap((item) => (item.bug ? [item.bug] : []));
  const bugIds = bugs.map((item) => item.id);
  const evidencePaths = executions
    .flatMap((item) => [...item.evidences, ...(item.bug?.evidences || [])])
    .map((item) => item.path)
    .filter(Boolean) as string[];
  await db.$transaction(async (tx) => {
    await tx.testCase.updateMany({
      where: { assigneeId: req.params.id },
      data: { assigneeId: null },
    });
    await tx.bug.updateMany({
      where: { assigneeId: req.params.id },
      data: { assigneeId: null },
    });
    await tx.comment.deleteMany({
      where: { OR: [{ authorId: req.params.id }, { bugId: { in: bugIds } }] },
    });
    await tx.evidence.deleteMany({
      where: {
        OR: [{ executionId: { in: executionIds } }, { bugId: { in: bugIds } }],
      },
    });
    await tx.bug.deleteMany({ where: { id: { in: bugIds } } });
    await tx.execution.deleteMany({ where: { id: { in: executionIds } } });
    await tx.auditLog.deleteMany({ where: { actorId: req.params.id } });
    await tx.user.delete({ where: { id: req.params.id } });
  });
  for (const evidencePath of evidencePaths)
    fs.rmSync(path.join(config.uploadDir, evidencePath), { force: true });
  return { deleted: true };
});
app.get("/api/v1/profiles", secure([Role.ADMIN]), async () =>
  db.accessProfile.findMany({
    where: { active: true },
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  }),
);
app.post("/api/v1/profiles", secure([Role.ADMIN]), async (req: any) => {
  const { name, description = "", permissions = [] } = req.body;
  if (!name || !Array.isArray(permissions))
    throw Object.assign(new Error("Nome e permissões são obrigatórios"), {
      statusCode: 400,
    });
  return db.accessProfile.create({
    data: {
      name,
      description,
      permissions,
      baseRole: permissions.includes("USERS_WRITE")
        ? Role.ADMIN
        : permissions.includes("TESTS_WRITE")
          ? Role.QA
          : permissions.includes("BUGS_WRITE")
            ? Role.DEV
            : Role.MANAGER,
    },
  });
});
app.put("/api/v1/profiles/:id", secure([Role.ADMIN]), async (req: any) => {
  const { name, description = "", permissions = [] } = req.body;
  return db.accessProfile.update({
    where: { id: req.params.id },
    data: {
      name,
      description,
      permissions,
      baseRole: permissions.includes("USERS_WRITE")
        ? Role.ADMIN
        : permissions.includes("TESTS_WRITE")
          ? Role.QA
          : permissions.includes("BUGS_WRITE")
            ? Role.DEV
            : Role.MANAGER,
    },
  });
});

app.get("/api/v1/meta", { ...guard }, async () => {
  const [modules, testTypes, cycles, users, templates] = await Promise.all([
    db.module.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.testType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.cycle.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profileId: true,
        profile: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.testTemplate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { modules, testTypes, cycles, users, templates };
});
app.post(
  "/api/v1/meta/:kind",
  secure([Role.ADMIN, Role.QA]),
  async (req: any) => {
    const {
      name,
      description = "",
      title = "",
      preconditions = "",
      steps = [],
      expectedResult = "",
    } = req.body;
    if (req.params.kind === "modules")
      return db.module.upsert({
        where: { name },
        update: { active: true },
        create: { name },
      });
    if (req.params.kind === "types")
      return db.testType.upsert({
        where: { name },
        update: { active: true },
        create: { name },
      });
    if (req.params.kind === "cycles")
      return db.cycle.upsert({
        where: { projectId_name: { projectId: "default-project", name } },
        update: { active: true, description },
        create: { name, description, projectId: "default-project" },
      });
    if (req.params.kind === "templates")
      return db.testTemplate.upsert({
        where: { name },
        update: { active: true, title, preconditions, steps, expectedResult },
        create: { name, title, preconditions, steps, expectedResult },
      });
    throw Object.assign(new Error("Cadastro inválido"), { statusCode: 400 });
  },
);
app.put(
  "/api/v1/meta/:kind/:id",
  secure([Role.ADMIN, Role.QA]),
  async (req: any) => {
    const name = String(req.body.name || "").trim();
    if (!name)
      throw Object.assign(new Error("Informe o novo nome"), {
        statusCode: 400,
      });
    if (req.params.kind === "modules")
      return db.module.update({ where: { id: req.params.id }, data: { name } });
    if (req.params.kind === "types")
      return db.testType.update({
        where: { id: req.params.id },
        data: { name },
      });
    if (req.params.kind === "cycles")
      return db.cycle.update({ where: { id: req.params.id }, data: { name } });
    if (req.params.kind === "templates")
      return db.testTemplate.update({
        where: { id: req.params.id },
        data: { name },
      });
    throw Object.assign(new Error("Cadastro inválido"), { statusCode: 400 });
  },
);
app.delete(
  "/api/v1/meta/:kind/:id",
  secure([Role.ADMIN, Role.QA]),
  async (req: any) => {
    if (req.params.kind === "modules")
      return db.module.update({
        where: { id: req.params.id },
        data: { active: false },
      });
    if (req.params.kind === "types")
      return db.testType.update({
        where: { id: req.params.id },
        data: { active: false },
      });
    if (req.params.kind === "cycles")
      return db.cycle.update({
        where: { id: req.params.id },
        data: { active: false },
      });
    if (req.params.kind === "templates")
      return db.testTemplate.update({
        where: { id: req.params.id },
        data: { active: false },
      });
    throw Object.assign(new Error("Cadastro inválido"), { statusCode: 400 });
  },
);

function whereCases(q: any) {
  const where: any = { active: q.active === "false" ? false : true };
  if (q.search)
    where.OR = [
      { code: { contains: q.search } },
      { title: { contains: q.search } },
    ];
  if (q.moduleId) where.moduleId = q.moduleId;
  if (q.testTypeId) where.testTypeId = q.testTypeId;
  if (q.assigneeId) where.assigneeId = q.assigneeId;
  if (q.dateFrom || q.dateTo)
    where.testDate = {
      ...(q.dateFrom && { gte: new Date(`${q.dateFrom}T00:00:00`) }),
      ...(q.dateTo && { lte: new Date(`${q.dateTo}T23:59:59`) }),
    };
  if (q.status || q.cycleId || q.bugStatus) {
    where.executions = {
      some: {
        ...(q.status && { status: q.status }),
        ...(q.cycleId && { cycleId: q.cycleId }),
        ...(q.bugStatus && { bug: { status: q.bugStatus } }),
      },
    };
  }
  return where;
}
app.get("/api/v1/cases", { ...guard }, async (req: any) => {
  const page = Math.max(1, Number(req.query.page) || 1),
    limit = Math.min(100, Number(req.query.limit) || 25),
    where = whereCases(req.query);
  const [items, total] = await Promise.all([
    db.testCase.findMany({
      where,
      include: {
        module: true,
        testType: true,
        assignee: { select: { id: true, name: true } },
        executions: {
          include: {
            cycle: true,
            executor: { select: { id: true, name: true } },
            bug: {
              include: {
                assignee: { select: { id: true, name: true } },
                comments: {
                  include: { author: { select: { name: true } } },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
            evidences: true,
          },
          orderBy: { executedAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.testCase.count({ where }),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
});
app.post("/api/v1/cases", secure([Role.ADMIN, Role.QA]), async (req) => {
  const data = testCaseSchema.parse(req.body);
  const last = await db.testCase.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const next = (Number(last?.code.match(/\d+/)?.[0] || 0) + 1)
    .toString()
    .padStart(3, "0");
  const item = await db.testCase.create({
    data: {
      ...data,
      testDate: data.testDate
        ? new Date(`${data.testDate}T12:00:00`)
        : new Date(),
      assigneeId: data.assigneeId || null,
      code: `CT-${next}`,
      projectId: "default-project",
    },
  });
  await audit(req.authUser.id, "CREATE", "TestCase", item.id);
  return item;
});
app.post("/api/v1/cases/quick", secure([Role.ADMIN, Role.QA]), async (req) => {
  const { execution, ...caseBody } = req.body as any;
  const data = testCaseSchema.parse(caseBody);
  const parsed = executionSchema.parse({
    ...execution,
    testCaseId: "temporary",
  });
  const { testCaseId: _ignored, ...exData } = parsed;
  const last = await db.testCase.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const next = (Number(last?.code.match(/\d+/)?.[0] || 0) + 1)
    .toString()
    .padStart(3, "0");
  const item = await db.$transaction(async (tx) => {
    const tc = await tx.testCase.create({
      data: {
        ...data,
        testDate: data.testDate
          ? new Date(`${data.testDate}T12:00:00`)
          : new Date(),
        assigneeId: data.assigneeId || null,
        code: `CT-${next}`,
        projectId: "default-project",
      },
    });
    const { bug, evidenceLinks, ...run } = exData;
    const ex = await tx.execution.create({
      data: { ...run, testCaseId: tc.id, executorId: req.authUser.id },
    });
    if (run.status === "FAILED" && bug)
      await tx.bug.create({
        data: {
          ...bug,
          assigneeId: bug.assigneeId || null,
          executionId: ex.id,
        },
      });
    for (const url of evidenceLinks)
      await tx.evidence.create({
        data: { name: "Link colado", url, executionId: ex.id },
      });
    return tc;
  });
  await audit(req.authUser.id, "CREATE_AND_EXECUTE", "TestCase", item.id);
  return item;
});
app.put(
  "/api/v1/cases/:id",
  secure([Role.ADMIN, Role.QA]),
  async (req: any) => {
    const data = testCaseSchema.partial().parse(req.body);
    const item = await db.testCase.update({
      where: { id: req.params.id },
      data: {
        ...data,
        testDate: data.testDate
          ? new Date(`${data.testDate}T12:00:00`)
          : undefined,
        assigneeId: data.assigneeId || null,
      },
    });
    await audit(req.authUser.id, "UPDATE", "TestCase", item.id, data);
    return item;
  },
);
app.post(
  "/api/v1/cases/:id/duplicate",
  secure([Role.ADMIN, Role.QA]),
  async (req: any) => {
    const old = await db.testCase.findUniqueOrThrow({
      where: { id: req.params.id },
    });
    const last = await db.testCase.findFirst({ orderBy: { code: "desc" } });
    const next = (Number(last?.code.match(/\d+/)?.[0] || 0) + 1)
      .toString()
      .padStart(3, "0");
    const { id, code, createdAt, updatedAt, ...copy } = old;
    return db.testCase.create({
      data: {
        ...copy,
        steps: copy.steps as any,
        code: `CT-${next}`,
        title: `${old.title} (cópia)`,
      },
    });
  },
);
app.delete(
  "/api/v1/cases/:id",
  secure([Role.ADMIN, Role.QA]),
  async (req: any) => {
    const executions = await db.execution.findMany({
      where: { testCaseId: req.params.id },
      include: { evidences: true, bug: { include: { evidences: true } } },
    });
    const paths = executions
      .flatMap((e) => [...e.evidences, ...(e.bug?.evidences || [])])
      .map((e) => e.path)
      .filter(Boolean) as string[];
    await db.$transaction(async (tx) => {
      const ids = executions.map((e) => e.id),
        bugIds = executions.flatMap((e) => (e.bug ? [e.bug.id] : []));
      await tx.comment.deleteMany({ where: { bugId: { in: bugIds } } });
      await tx.evidence.deleteMany({
        where: {
          OR: [{ executionId: { in: ids } }, { bugId: { in: bugIds } }],
        },
      });
      await tx.bug.deleteMany({ where: { id: { in: bugIds } } });
      await tx.execution.deleteMany({ where: { id: { in: ids } } });
      await tx.testCase.delete({ where: { id: req.params.id } });
    });
    for (const p of paths)
      fs.rmSync(path.join(config.uploadDir, p), { force: true });
    return { deleted: true };
  },
);

app.post("/api/v1/executions", secure([Role.ADMIN, Role.QA]), async (req) => {
  const input = executionSchema.parse(req.body);
  const { bug, evidenceLinks, ...data } = input;
  const ex = await db.execution.upsert({
    where: {
      testCaseId_cycleId: {
        testCaseId: data.testCaseId,
        cycleId: data.cycleId,
      },
    },
    create: { ...data, executorId: req.authUser.id },
    update: {
      status: data.status,
      actualResult: data.actualResult,
      notes: data.notes,
      executorId: req.authUser.id,
      executedAt: new Date(),
    },
  });
  if (data.status === "FAILED" && bug)
    await db.bug.upsert({
      where: { executionId: ex.id },
      create: {
        ...bug,
        assigneeId: bug.assigneeId || null,
        executionId: ex.id,
      },
      update: {
        ...bug,
        assigneeId: bug.assigneeId || null,
        status: BugStatus.REOPENED,
      },
    });
  await db.evidence.deleteMany({
    where: { executionId: ex.id, url: { not: null } },
  });
  for (const url of evidenceLinks)
    await db.evidence.create({
      data: { name: "Link colado", url, executionId: ex.id },
    });
  await audit(req.authUser.id, "EXECUTE", "Execution", ex.id, {
    status: data.status,
  });
  return ex;
});
app.patch(
  "/api/v1/bugs/:id/status",
  secure([Role.ADMIN, Role.QA, Role.DEV]),
  async (req: any) => {
    const status = BugStatus[req.body.status as keyof typeof BugStatus];
    if (!status)
      throw Object.assign(new Error("Status inválido"), { statusCode: 400 });
    if (
      req.authUser.role === "DEV" &&
      !([BugStatus.IN_PROGRESS, BugStatus.RESOLVED] as BugStatus[]).includes(
        status,
      )
    )
      throw Object.assign(
        new Error(
          "Desenvolvedores podem marcar apenas Em correção ou Resolvido",
        ),
        { statusCode: 403 },
      );
    const bug = await db.bug.update({
      where: { id: req.params.id },
      data: { status },
    });
    await audit(req.authUser.id, "STATUS", "Bug", bug.id, { status });
    return bug;
  },
);
app.post(
  "/api/v1/bugs/:id/comments",
  secure([Role.ADMIN, Role.QA, Role.DEV]),
  async (req: any) =>
    db.comment.create({
      data: {
        bugId: req.params.id,
        authorId: req.authUser.id,
        content: String(req.body.content || "").trim(),
      },
    }),
);
app.get("/api/v1/bugs", { ...guard }, async (req: any) => {
  const where: any = { execution: { testCase: { active: true } } };
  if (req.query.status) where.status = req.query.status;
  if (req.query.severity) where.severity = req.query.severity;
  if (req.query.assigneeId) where.assigneeId = req.query.assigneeId;
  if (req.query.cycleId)
    where.execution = {
      ...(where.execution || {}),
      cycleId: req.query.cycleId,
    };
  if (req.query.moduleId)
    where.execution = {
      ...(where.execution || {}),
      testCase: { active: true, moduleId: req.query.moduleId },
    };
  if (req.query.search)
    where.OR = [
      { description: { contains: req.query.search } },
      { execution: { testCase: { title: { contains: req.query.search } } } },
    ];
  return db.bug.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true } },
      execution: {
        include: {
          cycle: true,
          testCase: { include: { module: true } },
          evidences: true,
        },
      },
      comments: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
});

app.get("/api/v1/dashboard", { ...guard }, async (req: any) => {
  const cycleId = req.query.cycleId || undefined;
  const where: any = cycleId ? { cycleId } : {};
  const [totalCases, executions, bugs] = await Promise.all([
    db.testCase.count({ where: { active: true } }),
    db.execution.findMany({
      where,
      include: { testCase: { include: { module: true } }, cycle: true },
    }),
    db.bug.findMany({
      where: cycleId ? { execution: { cycleId } } : {},
      include: {
        execution: {
          include: { testCase: { include: { module: true } }, cycle: true },
        },
      },
    }),
  ]);
  const count = (s: ExecutionStatus) =>
    executions.filter((x) => x.status === s).length;
  const passed = count(ExecutionStatus.PASSED),
    failed = count(ExecutionStatus.FAILED),
    blocked = count(ExecutionStatus.BLOCKED),
    executed = passed + failed + blocked;
  const critical = bugs.filter((b) => b.severity === "CRITICAL").length;
  const high = bugs.filter((b) => b.severity === "HIGH").length;
  const byModule = Object.entries(
    bugs.reduce((a: any, b) => {
      const n = b.execution.testCase.module.name;
      a[n] = (a[n] || 0) + 1;
      return a;
    }, {}),
  ).map(([name, value]) => ({ name, value }));
  const byBugStatus = Object.values(BugStatus).map((status) => ({
    status,
    value: bugs.filter((b) => b.status === status).length,
  }));
  return {
    metrics: {
      total: cycleId
        ? new Set(executions.map((e) => e.testCaseId)).size
        : totalCases,
      executed,
      pending: Math.max(
        0,
        (cycleId
          ? new Set(executions.map((e) => e.testCaseId)).size
          : totalCases) - executed,
      ),
      passed,
      failed,
      blocked,
      critical,
      high,
      approval: executed ? Math.round((passed / executed) * 100) : 0,
    },
    byModule,
    byBugStatus,
  };
});

const allowedEvidenceTypes: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/quicktime": [".mov"],
};
app.post(
  "/api/v1/evidences",
  secure([Role.ADMIN, Role.QA, Role.DEV]),
  async (req: any) => {
    const part = await req.file();
    if (!part)
      throw Object.assign(new Error("Arquivo obrigatório"), {
        statusCode: 400,
      });
    const extensions = allowedEvidenceTypes[part.mimetype];
    const ext = path.extname(part.filename).toLowerCase();
    if (!extensions || !extensions.includes(ext))
      throw Object.assign(
        new Error(
          "Tipo de arquivo não permitido. Envie imagem (PNG, JPEG, GIF, WEBP), PDF ou vídeo (MP4, WEBM, MOV).",
        ),
        { statusCode: 400 },
      );
    const safe = `${Date.now()}-${path.basename(part.filename).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await pipeline(
      part.file,
      fs.createWriteStream(path.join(config.uploadDir, safe)),
    );
    return db.evidence.create({
      data: {
        name: part.filename,
        path: safe,
        mimeType: part.mimetype,
        size: part.file.bytesRead,
        executionId: part.fields.executionId?.value || null,
        bugId: part.fields.bugId?.value || null,
      },
    });
  },
);

app.get("/api/v1/exports/xlsx", { ...guard }, async (req: any, reply) => {
  const cases = await db.testCase.findMany({
    where: whereCases(req.query),
    include: {
      module: true,
      testType: true,
      assignee: true,
      executions: { include: { cycle: true, bug: true } },
    },
  });
  const wb = new ExcelJS.Workbook(),
    ws = wb.addWorksheet("Testes");
  ws.columns = [
    "ID",
    "Módulo",
    "Tipo",
    "Cenário",
    "Pré-condições",
    "Passos",
    "Resultado esperado",
    "Prioridade",
    "Responsável",
    "Ciclo",
    "Status",
    "Resultado obtido",
    "Bug",
    "Severidade",
    "Status do bug",
  ].map((header) => ({ header, key: header, width: 22 }));
  for (const t of cases) {
    const executions = t.executions.length ? t.executions : [null];
    for (const e of executions)
      ws.addRow({
        ID: t.code,
        Módulo: t.module.name,
        Tipo: t.testType.name,
        Cenário: t.title,
        "Pré-condições": t.preconditions,
        Passos: (t.steps as string[]).join("\n"),
        "Resultado esperado": t.expectedResult,
        Prioridade: t.priority,
        Responsável: t.assignee?.name || "",
        Ciclo: e?.cycle.name || "",
        Status: e?.status || "",
        "Resultado obtido": e?.actualResult || "",
        Bug: e?.bug?.description || "",
        Severidade: e?.bug?.severity || "",
        "Status do bug": e?.bug?.status || "",
      });
  }
  ws.getRow(1).font = { bold: true };
  reply
    .header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    .header(
      "Content-Disposition",
      'attachment; filename="relatorio-testes.xlsx"',
    );
  return reply.send(Buffer.from(await wb.xlsx.writeBuffer()));
});
app.get("/api/v1/exports/pdf", { ...guard }, async (req: any, reply) => {
  const data = await app.inject({
    method: "GET",
    url: `/api/v1/dashboard${req.url.includes("?") ? "?" + req.url.split("?")[1] : ""}`,
    cookies: { qa_session: (req.cookies as any).qa_session },
  });
  const d = data.json();
  const cycle = req.query.cycleId
    ? await db.cycle.findUnique({ where: { id: req.query.cycleId } })
    : null;

  reply
    .header("Content-Type", "application/pdf")
    .header(
      "Content-Disposition",
      'attachment; filename="dashboard-testes.pdf"',
    );

  const NAVY = "#12323b";
  const TEAL = "#0d9488";
  const RED = "#d9564d";
  const INK = "#18232b";
  const MUTED = "#68787c";
  const BORDER = "#dfe7e6";
  const marginX = 50;
  const barMaxWidth = 200;

  const doc = new PDFDocument({ margin: 0, size: "A4" });
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  function ensureSpace(y: number, needed: number) {
    if (y + needed <= pageHeight - 60) return y;
    doc.addPage();
    return 60;
  }

  function sectionTitle(text: string, y: number) {
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text(text, marginX, y);
    return y + 22;
  }

  function barRow(label: string, value: number, max: number, color: string, y: number) {
    doc.fillColor(INK).font("Helvetica").fontSize(10).text(label, marginX, y + 1, { width: 130 });
    const barWidth = max ? Math.max(3, (value / max) * barMaxWidth) : 3;
    doc.roundedRect(marginX + 140, y, barWidth, 9, 4).fill(color);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(String(value), marginX + 140 + barMaxWidth + 10, y + 1);
    return y + 20;
  }

  // Cabeçalho
  doc.rect(0, 0, pageWidth, 90).fill(NAVY);
  doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(11).text("QA MANAGER", marginX, 26);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(20).text("Relatório de Testes", marginX, 42);
  doc
    .fillColor("#bad0d1")
    .font("Helvetica")
    .fontSize(9)
    .text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, marginX, 68);
  doc
    .fillColor("#bad0d1")
    .fontSize(9)
    .text(cycle ? `Ciclo: ${cycle.name}` : "Todos os ciclos", pageWidth - marginX - 220, 68, {
      width: 220,
      align: "right",
    });

  let y = ensureSpace(120, 0);
  y = sectionTitle("Indicadores", y);

  const metricCards: [string, string | number][] = [
    ["Total", d.metrics.total],
    ["Executados", d.metrics.executed],
    ["Pendentes", d.metrics.pending],
    ["Aprovados", d.metrics.passed],
    ["Falharam", d.metrics.failed],
    ["Bloqueados", d.metrics.blocked],
    ["Severidade Crítica", d.metrics.critical],
    ["Severidade Alta", d.metrics.high],
    ["Aprovação", `${d.metrics.approval}%`],
  ];
  const cols = 3;
  const gap = 12;
  const cardW = (pageWidth - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = 56;
  metricCards.forEach(([label, value], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const cy = y + row * (cardH + gap);
    doc.roundedRect(x, cy, cardW, cardH, 6).fillAndStroke("white", BORDER);
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(label, x + 12, cy + 10, { width: cardW - 24 });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(18).text(String(value), x + 12, cy + 27);
  });
  y += Math.ceil(metricCards.length / cols) * (cardH + gap) + 10;

  y = ensureSpace(y, 40 + (d.byBugStatus?.length || 0) * 20);
  y = sectionTitle("Status dos bugs", y);
  const bugStatusList = (d.byBugStatus || []).map((b: any) => ({
    label: (labels.bug as any)[b.status] || b.status,
    value: b.value,
  }));
  const maxBug = Math.max(1, ...bugStatusList.map((b: any) => b.value));
  for (const b of bugStatusList) y = barRow(b.label, b.value, maxBug, TEAL, y);
  y += 15;

  const moduleList = d.byModule || [];
  y = ensureSpace(y, 40 + moduleList.length * 20);
  y = sectionTitle("Falhas por módulo", y);
  if (moduleList.length) {
    const maxModule = Math.max(1, ...moduleList.map((m: any) => m.value));
    for (const m of moduleList) y = barRow(m.name, m.value, maxModule, RED, y);
  } else {
    doc.fillColor(MUTED).font("Helvetica").fontSize(10).text("Nenhuma falha registrada", marginX, y);
    y += 20;
  }

  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8)
    .text("QA Manager — relatório gerado automaticamente", marginX, pageHeight - 40, {
      width: pageWidth - marginX * 2,
      align: "center",
    });

  doc.end();
  return reply.send(doc);
});

app.post(
  "/api/v1/import/preview",
  secure([Role.ADMIN, Role.QA]),
  async (req: any) => {
    const file = await req.file();
    if (!file)
      throw Object.assign(new Error("Planilha obrigatória"), {
        statusCode: 400,
      });
    const chunks = [];
    for await (const c of file.file) chunks.push(c);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.concat(chunks) as any);
    const ws = wb.getWorksheet("TESTES") || wb.worksheets[0];
    const rows: any[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const values = (row.values as any[])
        .slice(1)
        .map((v) =>
          typeof v === "object" && v?.text ? v.text : (v?.result ?? v ?? ""),
        );
      if (values[1])
        rows.push({
          date: values[0],
          code: String(values[1]),
          cycle: String(values[2] || "Importado"),
          module: String(values[3] || "Outros"),
          type: String(values[4] || "Funcional"),
          title: String(values[5] || ""),
          preconditions: String(values[6] || ""),
          expectedResult: String(values[7] || ""),
          status: String(values[8] || "Não testado"),
          actualResult: String(values[9] || ""),
          severity: String(values[10] || ""),
          priority: String(values[11] || ""),
          evidence: String(values[12] || ""),
          bugStatus: String(values[13] || ""),
        });
    });
    return { rows: rows.slice(0, 500), total: rows.length };
  },
);
app.post(
  "/api/v1/import/commit",
  secure([Role.ADMIN, Role.QA]),
  async (req: any) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length)
      throw Object.assign(new Error("Nenhuma linha para importar"), {
        statusCode: 400,
      });
    const qa = await db.user.findFirstOrThrow({ where: { role: Role.QA } });
    const statusMap: any = {
      Passou: "PASSED",
      Falhou: "FAILED",
      Bloqueado: "BLOCKED",
      "Não testado": "NOT_TESTED",
    };
    const sevMap: any = {
      Crítica: "CRITICAL",
      Alta: "HIGH",
      Média: "MEDIUM",
      Baixa: "LOW",
    };
    const priMap: any = {
      Urgente: "URGENT",
      Alta: "HIGH",
      Normal: "NORMAL",
      Média: "MEDIUM",
      Baixa: "LOW",
    };
    let imported = 0;
    const errors: any[] = [];
    for (const [index, r] of rows.entries()) {
      try {
        const mod = await db.module.upsert({
            where: { name: r.module || "Outros" },
            update: {},
            create: { name: r.module || "Outros" },
          }),
          type = await db.testType.upsert({
            where: { name: r.type || "Funcional" },
            update: {},
            create: { name: r.type || "Funcional" },
          }),
          cycle = await db.cycle.upsert({
            where: {
              projectId_name: {
                projectId: "default-project",
                name: r.cycle || "Importado",
              },
            },
            update: {},
            create: {
              projectId: "default-project",
              name: r.cycle || "Importado",
            },
          });
        const tc = await db.testCase.upsert({
          where: { code: r.code },
          update: {},
          create: {
            code: r.code,
            title: r.title || r.code,
            preconditions: r.preconditions || "",
            steps: [r.preconditions || "Executar o cenário descrito"],
            expectedResult:
              r.expectedResult || "Validar comportamento esperado",
            priority: priMap[r.priority] || "NORMAL",
            projectId: "default-project",
            moduleId: mod.id,
            testTypeId: type.id,
            assigneeId: qa.id,
          },
        });
        const status = statusMap[r.status] || "NOT_TESTED";
        const ex = await db.execution.upsert({
          where: {
            testCaseId_cycleId: { testCaseId: tc.id, cycleId: cycle.id },
          },
          update: { status, actualResult: r.actualResult || "" },
          create: {
            testCaseId: tc.id,
            cycleId: cycle.id,
            executorId: req.authUser.id,
            status,
            actualResult: r.actualResult || "",
          },
        });
        if (status === "FAILED")
          await db.bug.upsert({
            where: { executionId: ex.id },
            update: {},
            create: {
              executionId: ex.id,
              description: r.actualResult || "Falha importada da planilha",
              severity: sevMap[r.severity] || "MEDIUM",
              priority: priMap[r.priority] || "NORMAL",
            },
          });
        if (r.evidence)
          await db.evidence.create({
            data: {
              name: "Evidência importada",
              url: String(r.evidence),
              executionId: ex.id,
            },
          });
        imported++;
      } catch (e: any) {
        errors.push({ line: index + 2, message: e.message });
      }
    }
    return { imported, errors };
  },
);

if (config.isProduction && fs.existsSync(config.webDir)) {
  await app.register(fastifyStatic, {
    root: config.webDir,
    prefix: "/",
    decorateReply: false,
  });
  app.setNotFoundHandler((request, reply) => {
    if (
      request.method === "GET" &&
      !request.url.startsWith("/api/") &&
      !request.url.startsWith("/uploads/")
    ) {
      return reply
        .type("text/html; charset=utf-8")
        .send(fs.createReadStream(path.join(config.webDir, "index.html")));
    }
    return reply.status(404).send({
      error: { code: "NOT_FOUND", message: "Recurso não encontrado" },
    });
  });
}

app.listen({ port: config.port, host: config.host }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
