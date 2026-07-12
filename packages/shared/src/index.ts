import { z } from "zod";

export const roles = ["ADMIN", "QA", "DEV", "MANAGER"] as const;
export const executionStatuses = [
  "NOT_TESTED",
  "PASSED",
  "FAILED",
  "BLOCKED",
] as const;
export const bugStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "RETEST_OK",
  "REOPENED",
] as const;
export const priorities = [
  "URGENT",
  "HIGH",
  "NORMAL",
  "MEDIUM",
  "LOW",
] as const;
export const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Role = (typeof roles)[number];
export const permissions = [
  "TESTS_WRITE",
  "BUGS_WRITE",
  "SETTINGS_WRITE",
  "USERS_WRITE",
  "EXPORT",
] as const;
export const permissionLabels: Record<(typeof permissions)[number], string> = {
  TESTS_WRITE: "Criar, editar e excluir testes",
  BUGS_WRITE: "Atualizar e comentar bugs",
  SETTINGS_WRITE: "Gerenciar ciclos, módulos e tipos",
  USERS_WRITE: "Gerenciar usuários e perfis",
  EXPORT: "Exportar relatórios",
};

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export const testCaseSchema = z.object({
  title: z.string().min(3),
  moduleId: z.string().min(1),
  testTypeId: z.string().min(1),
  preconditions: z.string().default(""),
  steps: z.array(z.string().min(1)).min(1),
  expectedResult: z.string().min(3),
  priority: z.enum(priorities).default("NORMAL"),
  testDate: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  active: z.boolean().default(true),
});
export const executionSchema = z
  .object({
    testCaseId: z.string(),
    cycleId: z.string(),
    status: z.enum(executionStatuses),
    actualResult: z.string().default(""),
    notes: z.string().default(""),
    bug: z
      .object({
        description: z.string().min(3),
        severity: z.enum(severities),
        priority: z.enum(priorities),
        assigneeId: z.string().nullable().optional(),
      })
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.status === "FAILED" && !v.bug && !v.actualResult.trim())
      ctx.addIssue({
        code: "custom",
        message: "Informe o resultado obtido ou os dados do bug",
        path: ["actualResult"],
      });
  });

export const labels = {
  role: {
    ADMIN: "Administrador",
    QA: "QA",
    DEV: "Desenvolvedor",
    MANAGER: "Gestor",
  },
  execution: {
    NOT_TESTED: "Não testado",
    PASSED: "Passou",
    FAILED: "Falhou",
    BLOCKED: "Bloqueado",
  },
  bug: {
    OPEN: "Aberto",
    IN_PROGRESS: "Em correção",
    RESOLVED: "Resolvido",
    RETEST_OK: "Reteste OK",
    REOPENED: "Reaberto",
  },
  priority: {
    URGENT: "Urgente",
    HIGH: "Alta",
    NORMAL: "Normal",
    MEDIUM: "Média",
    LOW: "Baixa",
  },
  severity: {
    CRITICAL: "Crítica",
    HIGH: "Alta",
    MEDIUM: "Média",
    LOW: "Baixa",
  },
} as const;
