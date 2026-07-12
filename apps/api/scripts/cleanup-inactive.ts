import fs from "node:fs";
import path from "node:path";
import { db } from "../src/db.js";
import { config } from "../src/config.js";

const cases = await db.testCase.findMany({
  where: { active: false },
  include: { executions: { include: { evidences: true, bug: { include: { evidences: true } } } } },
});
for (const testCase of cases) {
  const executionIds = testCase.executions.map((item) => item.id);
  const bugs = testCase.executions.flatMap((item) => item.bug ? [item.bug] : []);
  const bugIds = bugs.map((item) => item.id);
  const evidencePaths = testCase.executions.flatMap((item) => [...item.evidences, ...(item.bug?.evidences || [])]).map((item) => item.path).filter(Boolean) as string[];
  await db.$transaction(async (tx) => {
    await tx.comment.deleteMany({ where: { bugId: { in: bugIds } } });
    await tx.evidence.deleteMany({ where: { OR: [{ executionId: { in: executionIds } }, { bugId: { in: bugIds } }] } });
    await tx.bug.deleteMany({ where: { id: { in: bugIds } } });
    await tx.execution.deleteMany({ where: { id: { in: executionIds } } });
    await tx.testCase.delete({ where: { id: testCase.id } });
  });
  for (const evidencePath of evidencePaths) fs.rmSync(path.join(config.uploadDir, evidencePath), { force: true });
}
console.log(`${cases.length} caso(s) inativo(s) e seus dados relacionados foram removidos.`);
await db.$disconnect();
