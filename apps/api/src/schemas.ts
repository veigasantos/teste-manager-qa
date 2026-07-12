import { z } from "zod";

const executionStatuses = ["NOT_TESTED", "PASSED", "FAILED", "BLOCKED"] as const;
const priorities = ["URGENT", "HIGH", "NORMAL", "MEDIUM", "LOW"] as const;
const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const testCaseSchema = z.object({
  title: z.string().min(3), moduleId: z.string().min(1), testTypeId: z.string().min(1),
  preconditions: z.string().default(""), steps: z.array(z.string().min(1)).min(1),
  expectedResult: z.string().min(3), priority: z.enum(priorities).default("NORMAL"),
  testDate: z.string().optional(), assigneeId: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export const executionSchema = z.object({
  testCaseId: z.string(), cycleId: z.string(), status: z.enum(executionStatuses),
  actualResult: z.string().default(""), notes: z.string().default(""),
  evidenceLinks: z.array(z.string().url()).max(20).default([]),
  bug: z.object({
    description: z.string().min(3), severity: z.enum(severities),
    priority: z.enum(priorities), assigneeId: z.string().nullable().optional(),
  }).optional(),
}).superRefine((value, context) => {
  if (value.status === "FAILED" && !value.bug && !value.actualResult.trim()) {
    context.addIssue({ code: "custom", message: "Informe o resultado obtido ou os dados do bug", path: ["actualResult"] });
  }
});
