import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo123", 10);
  const profileDefs = [
    {
      name: "Administrador",
      baseRole: Role.ADMIN,
      permissions: [
        "TESTS_WRITE",
        "BUGS_WRITE",
        "SETTINGS_WRITE",
        "USERS_WRITE",
        "EXPORT",
      ],
    },
    {
      name: "Qualidade",
      baseRole: Role.QA,
      permissions: ["TESTS_WRITE", "BUGS_WRITE", "SETTINGS_WRITE", "EXPORT"],
    },
    {
      name: "Desenvolvimento",
      baseRole: Role.DEV,
      permissions: ["BUGS_WRITE"],
    },
    { name: "Gestão", baseRole: Role.MANAGER, permissions: ["EXPORT"] },
  ];
  const profiles: any = {};
  for (const p of profileDefs)
    profiles[p.baseRole] = await db.accessProfile.upsert({
      where: { name: p.name },
      update: { permissions: p.permissions },
      create: { ...p, system: true },
    });
  await db.user.upsert({
    where: { email: "admin@local.test" },
    update: { profileId: profiles[Role.ADMIN].id },
    create: {
      name: "Administrador",
      email: "admin@local.test",
      role: Role.ADMIN,
      profileId: profiles[Role.ADMIN].id,
      passwordHash,
    },
  });
  await db.project.upsert({
    where: { id: "default-project" },
    update: {},
    create: { id: "default-project", name: "QA Manager" },
  });
  const moduleNames = [
    "Login",
    "Chamados",
    "Conversas",
    "Contatos",
    "Conexões",
    "Mensagens Automáticas",
    "Mensagens Rápidas",
    "Agentes",
    "Etiquetas",
    "Setores",
    "Configurações",
    "Usabilidade",
    "Outros",
  ];
  const typeNames = [
    "Funcional",
    "Validação",
    "Usabilidade",
    "Exploratório",
    "Regressão",
    "Responsividade",
    "Performance",
    "Segurança",
    "Teste de Borda",
  ];
  for (const name of moduleNames)
    await db.module.upsert({ where: { name }, update: {}, create: { name } });
  for (const name of typeNames)
    await db.testType.upsert({ where: { name }, update: {}, create: { name } });
  console.log("Dados criados. Login: admin@local.test / demo123");
}
main().finally(() => db.$disconnect());
