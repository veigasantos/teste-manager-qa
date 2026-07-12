import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bug as BugIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Columns3,
  Copy,
  Download,
  LayoutDashboard,
  LogOut,
  Plus,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  X,
  Edit3,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  bugStatuses,
  executionStatuses,
  labels,
  permissions,
  permissionLabels,
  priorities,
  severities,
} from "@qa/shared";
import { api, download } from "./api";

type User = {
  id: string;
  name: string;
  email: string;
  role: keyof typeof labels.role;
  profileName?: string;
  permissions?: string[];
};
type Notice = (text: string) => void;
const inputDate = (v?: string) =>
  v
    ? new Date(v).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
const badge = (s: string) => `badge ${s}`;
function stability(executions: any[]) {
  const decisive = executions.filter(
    (e) => e.status === "PASSED" || e.status === "FAILED",
  );
  const passed = decisive.filter((e) => e.status === "PASSED").length;
  const failed = decisive.length - passed;
  return { decisive: decisive.length, passed, failed, flaky: passed > 0 && failed > 0 };
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  async function submit(e: any) {
    e.preventDefault();
    try {
      onLogin(
        await api("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }),
      );
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <div className="login">
      <section className="loginHero">
        <div className="brand">
          <b className="brandMark">
            <ShieldCheck size={20} />
          </b>
          <span>QA Manager</span>
        </div>
        <h1>
          Qualidade visível.
          <br />
          Decisões mais rápidas.
        </h1>
        <p>Crie, execute e registre falhas em um único fluxo.</p>
      </section>
      <section className="loginForm">
        <form className="loginBox" onSubmit={submit}>
          <h2>Bem-vindo</h2>
          <p className="sub">Acesse seu ambiente local.</p>
          {error && <p className="error">{error}</p>}
          <label>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn primary">Entrar no sistema</button>
        </form>
      </section>
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: any;
}) {
  return (
    <header className="top">
      <div>
        <h1>{title}</h1>
        <p className="sub">{subtitle}</p>
      </div>
      <div className="actions">{children}</div>
    </header>
  );
}

function Dashboard({ meta }: { meta: any }) {
  const [data, setData] = useState<any>(),
    [cycle, setCycle] = useState("");
  useEffect(() => {
    api("/dashboard" + (cycle ? `?cycleId=${cycle}` : "")).then(setData);
  }, [cycle]);
  if (!data) return <div className="empty">Carregando indicadores...</div>;
  const m = data.metrics;
  return (
    <>
      <PageHeader title="Visão geral" subtitle="Situação atual dos testes">
        <select
          className="field"
          value={cycle}
          onChange={(e) => setCycle(e.target.value)}
        >
          <option value="">Todos os ciclos</option>
          {meta.cycles.map((x: any) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => download("/exports/pdf")}>
          <Download size={16} />
          PDF
        </button>
        <button className="btn" onClick={() => download("/exports/xlsx")}>
          <Download size={16} />
          Planilha
        </button>
      </PageHeader>
      <div className="metrics">
        {[
          ["Total", m.total],
          ["Executados", m.executed],
          ["Pendentes", m.pending],
          ["Aprovados", m.passed],
          ["Falharam", m.failed],
          ["Bloqueados", m.blocked],
          ["Severidade Crítica", m.critical],
          ["Severidade Alta", m.high],
          ["Aprovação", `${m.approval}%`],
        ].map(([a, b]) => (
          <div className="metric" key={a}>
            <span>{a}</span>
            <strong>{b}</strong>
          </div>
        ))}
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Falhas por módulo</h3>
          {data.byModule.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.byModule}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#16988c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty">Nenhuma falha registrada</div>
          )}
        </div>
        <div className="card">
          <h3>Status dos bugs</h3>
          {data.byBugStatus.map((x: any) => (
            <div className="bar" key={x.status}>
              <span>{(labels.bug as any)[x.status]}</span>
              <i style={{ width: `${Math.max(4, x.value * 35)}px` }} />
              <b>{x.value}</b>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const presets = [
  {
    name: "Login válido",
    title: "Login com credenciais válidas",
    preconditions: "Usuário cadastrado e ativo",
    steps:
      "Acessar a tela de login\nInformar e-mail e senha válidos\nSelecionar Entrar",
    expectedResult:
      "O sistema deve autenticar o usuário e exibir a tela inicial",
  },
  {
    name: "Campos obrigatórios",
    title: "Validar campos obrigatórios",
    preconditions: "Usuário na tela do formulário",
    steps: "Manter os campos obrigatórios vazios\nSelecionar Salvar",
    expectedResult:
      "O sistema deve destacar os campos obrigatórios e impedir o salvamento",
  },
  {
    name: "Fluxo CRUD",
    title: "Cadastrar, editar e excluir registro",
    preconditions: "Usuário autenticado com permissão",
    steps:
      "Criar um novo registro\nEditar o registro criado\nExcluir o registro",
    expectedResult:
      "Todas as operações devem ser concluídas e apresentar feedback",
  },
];

function TestEditor({
  meta,
  item,
  onClose,
  onSaved,
  notice,
}: {
  meta: any;
  item?: any;
  onClose: () => void;
  onSaved: (again: boolean) => void;
  notice: Notice;
}) {
  const current = item?.executions?.[0];
  const initial = () => ({
    testDate: inputDate(item?.testDate),
    title: item?.title || "",
    moduleId: item?.moduleId || meta.modules[0]?.id || "",
    testTypeId: item?.testTypeId || meta.testTypes[0]?.id || "",
    cycleId: current?.cycleId || meta.cycles[0]?.id || "",
    preconditions: item?.preconditions || "",
    steps: Array.isArray(item?.steps) ? item.steps.join("\n") : "",
    expectedResult: item?.expectedResult || "",
    priority: item?.priority || "NORMAL",
    assigneeId: item?.assigneeId || "",
    status: item?._requestedStatus || current?.status || "PASSED",
    actualResult: current?.actualResult || "",
    notes: current?.notes || "",
    bugDescription: current?.bug?.description || "",
    severity: current?.bug?.severity || "MEDIUM",
    bugPriority: current?.bug?.priority || "NORMAL",
    bugAssignee: current?.bug?.assigneeId || "",
    evidenceLinks: (current?.evidences || [])
      .map((e: any) => e.url)
      .filter(Boolean)
      .join("\n"),
  });
  const templates = meta.templates || [];
  const [form, setForm] = useState<any>(initial),
    [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  function applyTemplate(raw: string) {
    if (!raw) return;
    const t = [...presets, ...templates].find((x) => x.name === raw);
    if (t)
      setForm((f: any) => ({
        ...f,
        title: t.title,
        preconditions: t.preconditions,
        steps: Array.isArray(t.steps) ? t.steps.join("\n") : t.steps,
        expectedResult: t.expectedResult,
      }));
  }
  async function saveTemplate() {
    const name = prompt("Nome do modelo:");
    if (!name) return;
    const created = await api("/meta/templates", {
      method: "POST",
      body: JSON.stringify({
        name,
        title: form.title,
        preconditions: form.preconditions,
        steps: form.steps
          .split("\n")
          .map((step: string) => step.trim())
          .filter(Boolean),
        expectedResult: form.expectedResult,
      }),
    });
    meta.templates = [
      ...templates.filter((item: any) => item.id !== created.id),
      created,
    ];
    notice("Modelo salvo para os próximos testes");
  }
  async function createInlineOption(
    kind: "cycles" | "modules" | "types",
    metaKey: "cycles" | "modules" | "testTypes",
    field: "cycleId" | "moduleId" | "testTypeId",
    label: string,
  ) {
    const name = prompt(`Nome do novo ${label}:`)?.trim();
    if (!name) return;
    try {
      const created = await api(`/meta/${kind}`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      meta[metaKey] = [...meta[metaKey], created].sort((a: any, b: any) =>
        a.name.localeCompare(b.name, "pt-BR"),
      );
      set(field, created.id);
      notice(
        `${label.charAt(0).toUpperCase() + label.slice(1)} criado e selecionado`,
      );
    } catch (error: any) {
      notice(error.message);
    }
  }
  async function submit(e: any, again = false) {
    e.preventDefault();
    setBusy(true);
    try {
      const caseData = {
        testDate: form.testDate,
        title: form.title,
        moduleId: form.moduleId,
        testTypeId: form.testTypeId,
        preconditions: form.preconditions,
        steps: form.steps
          .split("\n")
          .map((x: string) => x.trim())
          .filter(Boolean),
        expectedResult: form.expectedResult,
        priority: form.priority,
        assigneeId: form.assigneeId || null,
        active: true,
      };
      const execution: any = {
        cycleId: form.cycleId,
        status: form.status,
        actualResult: form.actualResult,
        notes: form.notes,
        evidenceLinks: form.evidenceLinks
          .split("\n")
          .map((x: string) => x.trim())
          .filter(Boolean),
      };
      if (form.status === "FAILED")
        execution.bug = {
          description: form.bugDescription || form.actualResult,
          severity: form.severity,
          priority: form.bugPriority,
          assigneeId: form.bugAssignee || null,
        };
      if (item) {
        await api(`/cases/${item.id}`, {
          method: "PUT",
          body: JSON.stringify(caseData),
        });
        await api("/executions", {
          method: "POST",
          body: JSON.stringify({ ...execution, testCaseId: item.id }),
        });
      } else
        await api("/cases/quick", {
          method: "POST",
          body: JSON.stringify({ ...caseData, execution }),
        });
      notice(item ? "Teste atualizado" : "Teste salvo");
      onSaved(again);
      if (again)
        setForm({
          ...initial(),
          title: "",
          preconditions: form.preconditions,
          steps: "",
          expectedResult: "",
          status: "PASSED",
          actualResult: "",
          bugDescription: "",
        });
    } catch (e: any) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="drawerBack" onClick={onClose} />
      <form
        ref={formRef}
        className="drawer quickForm refinedForm"
        onSubmit={submit}
      >
        <div className="drawerHead">
          <div>
            <h2>{item ? `Editar ${item.code}` : "Novo teste"}</h2>
            <p className="sub">Caso, resultado e bug em um único formulário.</p>
          </div>
          <button type="button" className="iconBtn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="templateBar">
          <select
            className="field"
            defaultValue=""
            onChange={(e) => applyTemplate(e.target.value)}
          >
            <option value="">Usar um modelo...</option>
            <optgroup label="Modelos padrão">
              {presets.map((x) => (
                <option key={x.name}>{x.name}</option>
              ))}
            </optgroup>
            {templates.length > 0 && (
              <optgroup label="Meus modelos">
                {templates.map((x: any) => (
                  <option key={x.name}>{x.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <button type="button" className="btn" onClick={saveTemplate}>
            <Save size={15} />
            Salvar como modelo
          </button>
        </div>
        <div className="formRow three">
          <div>
            <label>Data</label>
            <input
              type="date"
              value={form.testDate}
              onChange={(e) => set("testDate", e.target.value)}
              required
            />
          </div>
          <div>
            <label>Ciclo</label>
            <select
              value={form.cycleId}
              onChange={(e) =>
                e.target.value === "__create__"
                  ? createInlineOption("cycles", "cycles", "cycleId", "ciclo")
                  : set("cycleId", e.target.value)
              }
              required
            >
              {meta.cycles.map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
              <option value="__create__">＋ Criar novo ciclo...</option>
            </select>
          </div>
          <div>
            <label>Resultado</label>
            <select
              className={`resultSelect ${form.status}`}
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {executionStatuses.map((x) => (
                <option key={x} value={x}>
                  {(labels.execution as any)[x]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label>Cenário</label>
        <input
          autoFocus
          required
          minLength={3}
          placeholder="Descreva objetivamente o que será validado"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
        />
        <div className="formRow">
          <div>
            <label>Módulo</label>
            <select
              value={form.moduleId}
              onChange={(e) =>
                e.target.value === "__create__"
                  ? createInlineOption(
                      "modules",
                      "modules",
                      "moduleId",
                      "módulo",
                    )
                  : set("moduleId", e.target.value)
              }
            >
              {meta.modules.map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
              <option value="__create__">＋ Criar novo módulo...</option>
            </select>
          </div>
          <div>
            <label>Tipo</label>
            <select
              value={form.testTypeId}
              onChange={(e) =>
                e.target.value === "__create__"
                  ? createInlineOption(
                      "types",
                      "testTypes",
                      "testTypeId",
                      "tipo",
                    )
                  : set("testTypeId", e.target.value)
              }
            >
              {meta.testTypes.map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
              <option value="__create__">＋ Criar novo tipo...</option>
            </select>
          </div>
        </div>
        <label>Pré-condições</label>
        <input
          placeholder="Opcional"
          value={form.preconditions}
          onChange={(e) => set("preconditions", e.target.value)}
        />
        <label>
          Passos para reprodução <small>— um passo por linha</small>
        </label>
        <textarea
          required
          className="stepsInput"
          placeholder={"Acessar a tela\nPreencher os dados\nConfirmar a ação"}
          value={form.steps}
          onChange={(e) => set("steps", e.target.value)}
        />
        <label>Resultado esperado</label>
        <textarea
          required
          value={form.expectedResult}
          onChange={(e) => set("expectedResult", e.target.value)}
        />
        {form.status !== "PASSED" && (
          <>
            <label>Resultado obtido / motivo</label>
            <textarea
              required={form.status === "FAILED"}
              value={form.actualResult}
              onChange={(e) => set("actualResult", e.target.value)}
            />
          </>
        )}
        {form.status === "FAILED" && (
          <section className="bugBox">
            <h3>Detalhes do bug</h3>
            <label>Descrição</label>
            <textarea
              required
              value={form.bugDescription}
              onChange={(e) => set("bugDescription", e.target.value)}
            />
            <div className="formRow three">
              <div>
                <label>Severidade</label>
                <select
                  value={form.severity}
                  onChange={(e) => set("severity", e.target.value)}
                >
                  {severities.map((x) => (
                    <option key={x} value={x}>
                      {(labels.severity as any)[x]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Prioridade</label>
                <select
                  value={form.bugPriority}
                  onChange={(e) => set("bugPriority", e.target.value)}
                >
                  {priorities.map((x) => (
                    <option key={x} value={x}>
                      {(labels.priority as any)[x]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Desenvolvedor</label>
                <select
                  value={form.bugAssignee}
                  onChange={(e) => set("bugAssignee", e.target.value)}
                >
                  <option value="">Não atribuído</option>
                  {meta.users
                    .filter((u: any) => u.role === "DEV")
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <label>Links de evidência</label>
            <textarea
              placeholder={
                "Cole aqui os links do Google Drive (um por linha)\nhttps://drive.google.com/..."
              }
              value={form.evidenceLinks}
              onChange={(e) => set("evidenceLinks", e.target.value)}
            />
          </section>
        )}
        <div className="stickyActions">
          <span className="shortcutHint">Ctrl + Enter para salvar</span>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          {!item && (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={(e) => submit(e, true)}
            >
              <Plus size={15} />
              Salvar e criar próximo
            </button>
          )}
          <button className="btn primary" disabled={busy}>
            <CheckCircle2 size={16} />
            Salvar
          </button>
        </div>
      </form>
    </>
  );
}

function TestsPage({
  meta,
  user,
  notice,
}: {
  meta: any;
  user: User;
  notice: Notice;
}) {
  const savedQuery = () =>
    JSON.parse(localStorage.getItem("qa_saved_view") || "null") || {
      search: "",
      status: "",
      cycleId: "",
      moduleId: "",
      dateFrom: "",
      dateTo: "",
      page: 1,
    };
  const [data, setData] = useState<any>({ items: [], total: 0 }),
    [query, setQuery] = useState<any>(savedQuery),
    [editor, setEditor] = useState<any>(null),
    [creating, setCreating] = useState(false),
    [columns, setColumns] = useState<any>(() =>
      JSON.parse(
        localStorage.getItem("qa_columns") ||
          '{"steps":true,"type":false,"priority":false}',
      ),
    ),
    [columnMenu, setColumnMenu] = useState(false);
  const canEdit = ["ADMIN", "QA"].includes(user.role);
  async function load() {
    const p = new URLSearchParams(
      Object.entries(query)
        .filter(([, v]) => v)
        .map(([k, v]) => [k, String(v)]),
    );
    setData(await api("/cases?" + p));
  }
  useEffect(() => {
    const t = setTimeout(load, 160);
    return () => clearTimeout(t);
  }, [JSON.stringify(query)]);
  function changeQuery(next: any) {
    setQuery({ ...query, ...next, page: 1 });
  }
  function saveView() {
    localStorage.setItem("qa_saved_view", JSON.stringify(query));
    notice("Filtros favoritos salvos");
  }
  function changeColumns(key: string) {
    const next = { ...columns, [key]: !columns[key] };
    setColumns(next);
    localStorage.setItem("qa_columns", JSON.stringify(next));
  }
  async function duplicate(id: string) {
    try {
      await api(`/cases/${id}/duplicate`, { method: "POST" });
      notice("Caso duplicado");
      load();
    } catch (e: any) {
      notice(e.message);
    }
  }
  async function remove(id: string, code: string) {
    if (!confirm(`Excluir ${code}?`)) return;
    try {
      await api(`/cases/${id}`, { method: "DELETE" });
      notice("Caso excluído");
      load();
    } catch (e: any) {
      notice(e.message);
    }
  }
  async function inlineStatus(item: any, status: string) {
    const ex = item.executions?.[0];
    if (status === "FAILED" || !ex) {
      setEditor({ ...item, _requestedStatus: status });
      return;
    }
    try {
      await api("/executions", {
        method: "POST",
        body: JSON.stringify({
          testCaseId: item.id,
          cycleId: ex.cycleId,
          status,
          actualResult: status === "BLOCKED" ? "Atualizado pela tabela" : "",
          notes: ex.notes || "",
        }),
      });
      notice("Resultado atualizado");
      load();
    } catch (e: any) {
      notice(e.message);
    }
  }
  return (
    <>
      <PageHeader
        title="Testes"
        subtitle="Crie, execute e acompanhe sem sair da lista"
      >
        <button className="btn" onClick={saveView}>
          <Star size={16} />
          Salvar filtros
        </button>
        <div className="columnControl">
          <button className="btn" onClick={() => setColumnMenu(!columnMenu)}>
            <Columns3 size={16} />
            Colunas
          </button>
          {columnMenu && (
            <div className="columnMenu">
              {[
                ["steps", "Passos"],
                ["type", "Tipo"],
                ["priority", "Prioridade"],
              ].map(([k, n]) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={columns[k]}
                    onChange={() => changeColumns(k)}
                  />
                  {n}
                </label>
              ))}
            </div>
          )}
        </div>
        <button className="btn" onClick={() => download("/exports/xlsx")}>
          <Download size={16} />
          Exportar
        </button>
        {canEdit && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Plus size={17} />
            Novo teste
          </button>
        )}
      </PageHeader>
      <div className="quick">
        {[
          ["", "Todos"],
          ["PASSED", "Passaram"],
          ["FAILED", "Falharam"],
          ["BLOCKED", "Bloqueados"],
          ["NOT_TESTED", "Não testados"],
        ].map(([v, n]) => (
          <button
            key={v}
            className={query.status === v ? "active" : ""}
            onClick={() => changeQuery({ status: v })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="filters linearControls">
        <div className="searchField">
          <Search size={16} />
          <input
            className="field search"
            placeholder="Buscar ID ou cenário..."
            value={query.search}
            onChange={(e) => changeQuery({ search: e.target.value })}
          />
        </div>
        <select
          className="field"
          value={query.cycleId}
          onChange={(e) => changeQuery({ cycleId: e.target.value })}
        >
          <option value="">Todos os ciclos</option>
          {meta.cycles.map((x: any) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={query.moduleId}
          onChange={(e) => changeQuery({ moduleId: e.target.value })}
        >
          <option value="">Todos os módulos</option>
          {meta.modules.map((x: any) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <label className="dateFilter">
          De{" "}
          <input
            className="field"
            type="date"
            value={query.dateFrom}
            onChange={(e) => changeQuery({ dateFrom: e.target.value })}
          />
        </label>
        <label className="dateFilter">
          Até{" "}
          <input
            className="field"
            type="date"
            value={query.dateTo}
            onChange={(e) => changeQuery({ dateTo: e.target.value })}
          />
        </label>
        <button
          className="btn"
          onClick={() =>
            setQuery({
              search: "",
              status: "",
              cycleId: "",
              moduleId: "",
              dateFrom: "",
              dateTo: "",
              page: 1,
            })
          }
        >
          <X size={15} />
          Limpar
        </button>
      </div>
      <div className="tableWrap compactTable">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>ID</th>
              <th>Cenário</th>
              {columns.steps && <th>Passos para reprodução</th>}
              <th>Módulo</th>
              {columns.type && <th>Tipo</th>}
              {columns.priority && <th>Prioridade</th>}
              <th>Ciclo</th>
              <th>Resultado</th>
              <th>Bug</th>
              <th>Histórico</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((x: any) => {
              const ex =
                x.executions?.find(
                  (e: any) => !query.cycleId || e.cycleId === query.cycleId,
                ) || x.executions?.[0];
              return (
                <tr key={x.id}>
                  <td>{new Date(x.testDate).toLocaleDateString("pt-BR")}</td>
                  <td className="code">{x.code}</td>
                  <td className="scenario" title={x.title}>
                    {x.title}
                  </td>
                  {columns.steps && (
                    <td
                      className="stepsCell"
                      title={(x.steps || []).join(" • ")}
                    >
                      {(x.steps || []).map((s: string, i: number) => (
                        <span key={i}>
                          {i + 1}. {s}
                        </span>
                      ))}
                    </td>
                  )}
                  <td>{x.module.name}</td>
                  {columns.type && <td>{x.testType.name}</td>}
                  {columns.priority && (
                    <td>{(labels.priority as any)[x.priority]}</td>
                  )}
                  <td>{ex?.cycle.name || "—"}</td>
                  <td>
                    {canEdit ? (
                      <select
                        className={`inlineStatus ${ex?.status || "NOT_TESTED"}`}
                        value={ex?.status || "NOT_TESTED"}
                        onChange={(e) => inlineStatus(x, e.target.value)}
                      >
                        {executionStatuses.map((s) => (
                          <option key={s} value={s}>
                            {(labels.execution as any)[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={badge(ex?.status || "NOT_TESTED")}>
                        {(labels.execution as any)[ex?.status || "NOT_TESTED"]}
                      </span>
                    )}
                  </td>
                  <td>
                    {ex?.bug ? (
                      <span className={badge(ex.bug.status)}>
                        {(labels.bug as any)[ex.bug.status]}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="historyCell">
                    {x.executions?.length ? (
                      <>
                        <div className="historyDots">
                          {[...x.executions]
                            .reverse()
                            .map((execution: any) => (
                              <span
                                key={execution.id}
                                className={`historyDot ${execution.status}`}
                                title={`${execution.cycle.name} — ${(labels.execution as any)[execution.status]}`}
                              />
                            ))}
                        </div>
                        {stability(x.executions).flaky && (
                          <small
                            className="flakyBadge"
                            title={`Alterna entre Passou e Falhou entre ciclos (${stability(x.executions).passed} passou / ${stability(x.executions).failed} falhou)`}
                          >
                            ⚠ Instável
                          </small>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="rowActions">
                      {canEdit && (
                        <button
                          title="Editar"
                          className="iconBtn"
                          onClick={() => setEditor(x)}
                        >
                          <Edit3 size={15} />
                        </button>
                      )}
                      <button
                        title="Duplicar"
                        className="iconBtn"
                        onClick={() => duplicate(x.id)}
                      >
                        <Copy size={15} />
                      </button>
                      {canEdit && (
                        <button
                          title="Excluir"
                          className="iconBtn danger"
                          onClick={() => remove(x.id, x.code)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data.items.length && (
          <div className="empty">Nenhum teste encontrado.</div>
        )}
      </div>
      <div className="pagination">
        <span>
          Página {data.page || 1} de {data.pages || 1}
        </span>
        <button
          className="btn"
          disabled={query.page <= 1}
          onClick={() => setQuery({ ...query, page: query.page - 1 })}
        >
          Anterior
        </button>
        <button
          className="btn"
          disabled={query.page >= data.pages}
          onClick={() => setQuery({ ...query, page: query.page + 1 })}
        >
          Próxima
        </button>
      </div>
      {(creating || editor) && (
        <TestEditor
          meta={meta}
          item={editor || undefined}
          onClose={() => {
            setCreating(false);
            setEditor(null);
          }}
          onSaved={(again) => {
            load();
            if (!again) {
              setCreating(false);
              setEditor(null);
            }
          }}
          notice={notice}
        />
      )}
    </>
  );
}

function BugsPage({
  user,
  meta,
  notice,
}: {
  user: User;
  meta: any;
  notice: Notice;
}) {
  const [items, setItems] = useState<any[]>([]),
    [filters, setFilters] = useState({
      search: "",
      status: "",
      severity: "",
      cycleId: "",
      moduleId: "",
      assigneeId: "",
    }),
    [notes, setNotes] = useState<Record<string, string>>({});
  async function load() {
    const p = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value),
    );
    setItems(await api("/bugs?" + p));
  }
  useEffect(() => {
    const t = setTimeout(load, 160);
    return () => clearTimeout(t);
  }, [JSON.stringify(filters)]);
  const setFilter = (key: string, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  async function change(id: string, value: string) {
    try {
      await api(`/bugs/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: value }),
      });
      notice("Status atualizado");
      load();
      window.dispatchEvent(new Event("qa-bug-change"));
    } catch (e: any) {
      notice(e.message);
    }
  }
  async function addNote(bugId: string) {
    const content = notes[bugId]?.trim();
    if (!content) return;
    try {
      await api(`/bugs/${bugId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setNotes((current) => ({ ...current, [bugId]: "" }));
      notice("Anotação adicionada");
      load();
      window.dispatchEvent(new Event("qa-bug-change"));
    } catch (e: any) {
      notice(e.message);
    }
  }
  const canWrite =
    user.permissions?.includes("BUGS_WRITE") ??
    ["ADMIN", "QA", "DEV"].includes(user.role);
  const allowed =
    user.role === "DEV" ? ["IN_PROGRESS", "RESOLVED"] : bugStatuses;
  return (
    <>
      <PageHeader
        title="Bugs"
        subtitle="Informações completas para reprodução e acompanhamento"
      />
      <div className="filters linearControls">
        <div className="searchField">
          <Search size={16} />
          <input
            className="field search"
            placeholder="Buscar caso ou descrição..."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
          />
        </div>
        <select
          className="field"
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">Todos os status</option>
          {bugStatuses.map((s) => (
            <option key={s} value={s}>
              {(labels.bug as any)[s]}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.severity}
          onChange={(e) => setFilter("severity", e.target.value)}
        >
          <option value="">Todas as severidades</option>
          {severities.map((s) => (
            <option key={s} value={s}>
              {(labels.severity as any)[s]}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.cycleId}
          onChange={(e) => setFilter("cycleId", e.target.value)}
        >
          <option value="">Todos os ciclos</option>
          {meta.cycles.map((x: any) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.moduleId}
          onChange={(e) => setFilter("moduleId", e.target.value)}
        >
          <option value="">Todos os módulos</option>
          {meta.modules.map((x: any) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.assigneeId}
          onChange={(e) => setFilter("assigneeId", e.target.value)}
        >
          <option value="">Todos os responsáveis</option>
          {meta.users.map((x: any) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <button
          className="btn"
          onClick={() =>
            setFilters({
              search: "",
              status: "",
              severity: "",
              cycleId: "",
              moduleId: "",
              assigneeId: "",
            })
          }
        >
          <X size={15} />
          Limpar
        </button>
      </div>
      <div className="tableWrap compactTable">
        <table>
          <thead>
            <tr>
              <th>Caso</th>
              <th>Descrição</th>
              <th>Passos para reprodução</th>
              <th>Módulo</th>
              <th>Ciclo</th>
              <th>Severidade</th>
              <th>Responsável</th>
              <th>Status</th>
              <th>Evidências</th>
              <th>Anotações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td className="scenario">
                  <b className="code">{x.execution.testCase.code}</b>
                  <br />
                  {x.execution.testCase.title}
                </td>
                <td className="scenario">{x.description}</td>
                <td className="stepsCell bugSteps">
                  {(x.execution.testCase.steps || []).map(
                    (step: string, index: number) => (
                      <span key={index}>
                        {index + 1}. {step}
                      </span>
                    ),
                  )}
                </td>
                <td>{x.execution.testCase.module.name}</td>
                <td>{x.execution.cycle.name}</td>
                <td>{(labels.severity as any)[x.severity]}</td>
                <td>{x.assignee?.name || "—"}</td>
                <td>
                  {canWrite ? (
                    <select
                      className={`inlineStatus ${x.status}`}
                      value={x.status}
                      onChange={(e) => change(x.id, e.target.value)}
                    >
                      {allowed.map((s) => (
                        <option key={s} value={s}>
                          {(labels.bug as any)[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={badge(x.status)}>
                      {(labels.bug as any)[x.status]}
                    </span>
                  )}
                </td>
                <td className="evidenceCell">
                  {x.execution.evidences?.length ? (
                    x.execution.evidences.map((evidence: any) => (
                      <a
                        key={evidence.id}
                        href={evidence.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {evidence.name || "Evidência"}
                      </a>
                    ))
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td className="notesCell">
                  <details>
                    <summary>
                      {x.comments.length
                        ? `${x.comments.length} anotação(ões)`
                        : "Adicionar anotação"}
                    </summary>
                    <div className="noteList">
                      {x.comments.map((comment: any) => (
                        <div key={comment.id}>
                          <b>{comment.author.name}</b>
                          <span>{comment.content}</span>
                        </div>
                      ))}
                    </div>
                    {canWrite && (
                      <div className="noteComposer">
                        <textarea
                          placeholder="Escreva uma anotação..."
                          value={notes[x.id] || ""}
                          onChange={(e) =>
                            setNotes((current) => ({
                              ...current,
                              [x.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          className="btn primary"
                          onClick={() => addNote(x.id)}
                        >
                          Salvar
                        </button>
                      </div>
                    )}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <div className="empty">Nenhum bug encontrado.</div>}
      </div>
    </>
  );
}

function SettingsPage({
  meta,
  reload,
  user,
  notice,
}: {
  meta: any;
  reload: () => void;
  user: User;
  notice: Notice;
}) {
  const canAdmin =
    user.permissions?.includes("USERS_WRITE") ?? user.role === "ADMIN";
  const [tab, setTab] = useState(canAdmin ? "access" : "catalogs"),
    [kind, setKind] = useState(""),
    [name, setName] = useState(""),
    [modelForm, setModelForm] = useState({
      title: "",
      preconditions: "",
      steps: "",
      expectedResult: "",
    }),
    [profiles, setProfiles] = useState<any[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [profileForm, setProfileForm] = useState<any>({
      id: "",
      name: "",
      description: "",
      permissions: [],
    }),
    [userForm, setUserForm] = useState<any>({
      name: "",
      email: "",
      password: "",
      profileId: "",
    });
  async function loadAccess() {
    if (!canAdmin) return;
    const [profileData, userData] = await Promise.all([
      api("/profiles"),
      api("/users"),
    ]);
    setProfiles(profileData);
    setUsers(userData);
    setUserForm((current: any) => ({
      ...current,
      profileId: current.profileId || profileData[0]?.id || "",
    }));
  }
  useEffect(() => {
    loadAccess();
  }, []);
  async function add(e: any) {
    e.preventDefault();
    if (!kind) return;
    try {
      if (kind === "models") {
        await api("/meta/templates", {
          method: "POST",
          body: JSON.stringify({
            name,
            ...modelForm,
            steps: modelForm.steps
              .split("\n")
              .map((step) => step.trim())
              .filter(Boolean),
          }),
        });
        setName("");
        setModelForm({
          title: "",
          preconditions: "",
          steps: "",
          expectedResult: "",
        });
        await reload();
        notice("Modelo adicionado");
        return;
      }
      await api(`/meta/${kind}`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      reload();
      notice("Cadastro adicionado");
    } catch (e: any) {
      notice(e.message);
    }
  }
  async function deleteCatalogItem(item: any) {
    if (!confirm(`Apagar "${item.name}"?`)) return;
    try {
      const apiKind = kind === "models" ? "templates" : kind;
      await api(`/meta/${apiKind}/${item.id}`, { method: "DELETE" });
      await reload();
      notice("Item removido das novas seleções");
    } catch (error: any) {
      notice(error.message);
    }
  }
  async function renameCatalogItem(item: any) {
    const newName = prompt("Novo nome:", item.name)?.trim();
    if (!newName || newName === item.name) return;
    try {
      const apiKind = kind === "models" ? "templates" : kind;
      await api(`/meta/${apiKind}/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: newName }),
      });
      await reload();
      notice("Nome atualizado");
    } catch (error: any) {
      notice(error.message);
    }
  }
  async function deleteUser(managed: any) {
    const accepted = confirm(
      `ATENÇÃO: excluir ${managed.name} é uma ação definitiva e não pode ser desfeita. Todos os dados vinculados a este usuário serão perdidos. Deseja continuar?`,
    );
    if (!accepted) return;
    try {
      await api(`/users/${managed.id}`, { method: "DELETE" });
      notice("Usuário excluído definitivamente");
      loadAccess();
      reload();
    } catch (error: any) {
      notice(error.message);
    }
  }
  async function saveProfile(e: any) {
    e.preventDefault();
    try {
      const body = JSON.stringify({
        name: profileForm.name,
        description: profileForm.description,
        permissions: profileForm.permissions,
      });
      await api(profileForm.id ? `/profiles/${profileForm.id}` : "/profiles", {
        method: profileForm.id ? "PUT" : "POST",
        body,
      });
      setProfileForm({ id: "", name: "", description: "", permissions: [] });
      notice("Perfil de acesso salvo");
      loadAccess();
    } catch (e: any) {
      notice(e.message);
    }
  }
  async function createUser(e: any) {
    e.preventDefault();
    try {
      await api("/users", { method: "POST", body: JSON.stringify(userForm) });
      setUserForm({
        name: "",
        email: "",
        password: "",
        profileId: profiles[0]?.id || "",
      });
      notice("Usuário criado");
      loadAccess();
      reload();
    } catch (e: any) {
      notice(e.message);
    }
  }
  async function updateUser(id: string, data: any) {
    try {
      await api(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      notice("Usuário atualizado");
      loadAccess();
      reload();
    } catch (e: any) {
      notice(e.message);
    }
  }
  function togglePermission(value: string) {
    setProfileForm((current: any) => ({
      ...current,
      permissions: current.permissions.includes(value)
        ? current.permissions.filter((x: string) => x !== value)
        : [...current.permissions, value],
    }));
  }
  const catalogItems =
    kind === "models"
      ? meta.templates || []
      : kind === "cycles"
        ? meta.cycles
        : kind === "modules"
          ? meta.modules
          : kind === "types"
            ? meta.testTypes
            : [];
  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Cadastros, usuários e níveis de acesso"
      />
      <div className="settingsTabs">
        <button
          className={tab === "catalogs" ? "active" : ""}
          onClick={() => setTab("catalogs")}
        >
          Cadastros
        </button>
        {canAdmin && (
          <button
            className={tab === "access" ? "active" : ""}
            onClick={() => setTab("access")}
          >
            Usuários e acessos
          </button>
        )}
      </div>
      {tab === "catalogs" && (
        <div className="card">
          <h3>Novo cadastro</h3>
          {(user.permissions?.includes("SETTINGS_WRITE") ??
          ["ADMIN", "QA"].includes(user.role)) ? (
            <form className="filters linearControls" onSubmit={add}>
              <select
                className="field"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setName("");
                }}
              >
                <option value="">Nenhum</option>
                <option value="models">Modelo</option>
                <option value="cycles">Ciclo</option>
                <option value="modules">Módulo</option>
                <option value="types">Tipo</option>
              </select>
              {kind && (
                <input
                  className="field"
                  placeholder={kind === "models" ? "Nome do modelo" : "Nome"}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
              <button className="btn primary" disabled={!kind}>
                Adicionar
              </button>
              {kind === "models" && (
                <div className="modelFields">
                  <input
                    className="field"
                    placeholder="Cenário sugerido"
                    value={modelForm.title}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, title: e.target.value })
                    }
                  />
                  <textarea
                    placeholder="Passos, um por linha"
                    value={modelForm.steps}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, steps: e.target.value })
                    }
                  />
                  <textarea
                    placeholder="Resultado esperado"
                    value={modelForm.expectedResult}
                    onChange={(e) =>
                      setModelForm({
                        ...modelForm,
                        expectedResult: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </form>
          ) : (
            <p className="sub">Perfil somente leitura.</p>
          )}
          {kind && (
            <div className="catalogList">
              <h3>Itens cadastrados</h3>
              {catalogItems.length ? (
                catalogItems.map((item: any) => (
                  <div key={item.id || item.name}>
                    <span>{item.name}</span>
                    <div className="catalogActions">
                      <button className="iconBtn" title="Editar nome" onClick={() => renameCatalogItem(item)}>
                        <Edit3 size={15} />
                      </button>
                      <button className="iconBtn danger" title="Apagar" onClick={() => deleteCatalogItem(item)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="sub">Nenhum item cadastrado nesta categoria.</p>
              )}
            </div>
          )}
        </div>
      )}
      {tab === "access" && canAdmin && (
        <div className="accessGrid">
          <section className="card">
            <h3>
              {profileForm.id
                ? "Editar perfil de acesso"
                : "Novo perfil de acesso"}
            </h3>
            <form onSubmit={saveProfile} className="accessForm">
              <label>Nome</label>
              <input
                className="field"
                required
                value={profileForm.name}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, name: e.target.value })
                }
              />
              <label>Descrição</label>
              <input
                className="field"
                value={profileForm.description}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    description: e.target.value,
                  })
                }
              />
              <label>Permissões</label>
              <div className="permissionList">
                {permissions.map((permission) => (
                  <label key={permission}>
                    <input
                      type="checkbox"
                      checked={profileForm.permissions.includes(permission)}
                      onChange={() => togglePermission(permission)}
                    />
                    <span>{permissionLabels[permission]}</span>
                  </label>
                ))}
              </div>
              <div className="actions">
                <button className="btn primary">Salvar perfil</button>
                {profileForm.id && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setProfileForm({
                        id: "",
                        name: "",
                        description: "",
                        permissions: [],
                      })
                    }
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
            <div className="profileList">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() =>
                    setProfileForm({
                      id: profile.id,
                      name: profile.name,
                      description: profile.description,
                      permissions: profile.permissions,
                    })
                  }
                >
                  <span>
                    <b>{profile.name}</b>
                    <small>{profile._count.users} usuário(s)</small>
                  </span>
                  <Edit3 size={15} />
                </button>
              ))}
            </div>
          </section>
          <section className="card">
            <h3>Novo usuário</h3>
            <form className="accessForm" onSubmit={createUser}>
              <label>Nome</label>
              <input
                className="field"
                required
                value={userForm.name}
                onChange={(e) =>
                  setUserForm({ ...userForm, name: e.target.value })
                }
              />
              <label>E-mail</label>
              <input
                className="field"
                type="email"
                required
                value={userForm.email}
                onChange={(e) =>
                  setUserForm({ ...userForm, email: e.target.value })
                }
              />
              <label>Senha inicial</label>
              <input
                className="field"
                type="password"
                minLength={6}
                required
                value={userForm.password}
                onChange={(e) =>
                  setUserForm({ ...userForm, password: e.target.value })
                }
              />
              <label>Perfil de acesso</label>
              <select
                className="field"
                required
                value={userForm.profileId}
                onChange={(e) =>
                  setUserForm({ ...userForm, profileId: e.target.value })
                }
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <button className="btn primary">Criar usuário</button>
            </form>
            <h3 className="sectionTitle">Usuários cadastrados</h3>
            <div className="managedUsers">
              {users.map((managed) => (
                <div key={managed.id}>
                  <span>
                    <b>{managed.name}</b>
                    <small>{managed.email}</small>
                  </span>
                  <select
                    className="field"
                    value={managed.profileId || ""}
                    onChange={(e) =>
                      updateUser(managed.id, { profileId: e.target.value })
                    }
                  >
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className={`statusToggle ${managed.active ? "active" : ""}`}
                    disabled={managed.id === user.id}
                    onClick={() =>
                      updateUser(managed.id, { active: !managed.active })
                    }
                  >
                    {managed.active ? "Ativo" : "Inativo"}
                  </button>
                  <button
                    className="iconBtn danger deleteUserButton"
                    title={
                      managed.id === user.id
                        ? "Não é possível excluir o usuário conectado"
                        : "Excluir usuário definitivamente"
                    }
                    disabled={managed.id === user.id}
                    onClick={() => deleteUser(managed)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(
      () => localStorage.getItem("qa_current_page") || "dashboard",
    ),
    [meta, setMeta] = useState<any>(),
    [collapsed, setCollapsed] = useState(
      () => localStorage.getItem("qa_sidebar") === "collapsed",
    ),
    [message, setMessage] = useState(""),
    [environmentError, setEnvironmentError] = useState(""),
    [bugAlerts, setBugAlerts] = useState(0);
  const bugSnapshot = useRef(""),
    audioContext = useRef<AudioContext | null>(null);
  async function reload() {
    try {
      setEnvironmentError("");
      let environment = await api("/meta");
      const localTemplates = JSON.parse(localStorage.getItem("qa_templates") || "[]");
      const canMigrate =
        user &&
        (user.permissions?.includes("TESTS_WRITE") ??
          ["ADMIN", "QA"].includes(user.role));
      if (canMigrate && localTemplates.length) {
        for (const template of localTemplates) {
          await api("/meta/templates", {
            method: "POST",
            body: JSON.stringify({
              ...template,
              steps: Array.isArray(template.steps)
                ? template.steps
                : String(template.steps || "")
                    .split("\n")
                    .map((step) => step.trim())
                    .filter(Boolean),
            }),
          });
        }
        localStorage.removeItem("qa_templates");
        environment = await api("/meta");
      }
      setMeta(environment);
    } catch (error: any) {
      setEnvironmentError(
        error.message || "Não foi possível carregar o ambiente",
      );
    }
  }
  function notice(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(""), 3000);
  }
  function playNotificationSound() {
    const context = audioContext.current;
    if (!context || context.state !== "running") return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.22);
  }
  function bugSnapshotOf(bugs: any[]) {
    return JSON.stringify(
      bugs.map((bug: any) => [
        bug.id,
        bug.status,
        bug.updatedAt,
        bug.comments.map((comment: any) => comment.id),
      ]),
    );
  }
  async function checkBugUpdates() {
    if (!user) return;
    try {
      const bugs = await api("/bugs");
      const snapshot = bugSnapshotOf(bugs);
      if (bugSnapshot.current && bugSnapshot.current !== snapshot) {
        setBugAlerts((current) => current + 1);
        notice("Há uma nova atualização na aba Bugs");
        playNotificationSound();
      }
      bugSnapshot.current = snapshot;
    } catch {}
  }
  // Resincroniza silenciosamente após uma ação própria (mudar status, comentar):
  // evita que o polling de checkBugUpdates confunda nossa própria mudança com
  // uma atualização externa e dispare o aviso "Há uma nova atualização" por cima
  // do toast de confirmação da própria ação.
  async function syncBugSnapshot() {
    try {
      bugSnapshot.current = bugSnapshotOf(await api("/bugs"));
    } catch {}
  }
  useEffect(() => {
    api("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (user) reload();
  }, [user]);
  useEffect(() => {
    if (!user) return;
    checkBugUpdates();
    const interval = window.setInterval(checkBugUpdates, 12000);
    const immediate = () => syncBugSnapshot();
    window.addEventListener("qa-bug-change", immediate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("qa-bug-change", immediate);
    };
  }, [user]);
  useEffect(() => {
    const unlockAudio = () => {
      if (!audioContext.current) audioContext.current = new AudioContext();
      audioContext.current.resume().catch(() => {});
    };
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => document.removeEventListener("pointerdown", unlockAudio);
  }, []);
  useEffect(() => {
    let table: HTMLElement | null = null,
      startX = 0,
      startScroll = 0,
      dragging = false;
    const down = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        (event.target as HTMLElement).closest(
          "button,input,select,textarea,a,summary,label",
        )
      )
        return;
      table = (event.target as HTMLElement).closest(
        ".tableWrap",
      ) as HTMLElement | null;
      if (!table || table.scrollWidth <= table.clientWidth) {
        table = null;
        return;
      }
      startX = event.clientX;
      startScroll = table.scrollLeft;
      dragging = false;
    };
    const move = (event: MouseEvent) => {
      if (!table) return;
      const distance = event.clientX - startX;
      if (Math.abs(distance) > 3) dragging = true;
      if (dragging) {
        event.preventDefault();
        table.classList.add("isDragging");
        table.scrollLeft = startScroll - distance;
      }
    };
    const up = () => {
      table?.classList.remove("isDragging");
      table = null;
      dragging = false;
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
  }, []);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("qa_sidebar", next ? "collapsed" : "open");
  }
  function navigate(nextPage: string) {
    setPage(nextPage);
    localStorage.setItem("qa_current_page", nextPage);
    if (nextPage === "bugs") setBugAlerts(0);
  }
  if (loading) return <div className="empty">Iniciando...</div>;
  if (!user) return <Login onLogin={setUser} />;
  if (!meta && environmentError)
    return (
      <div className="environmentFailure">
        <ShieldCheck size={32} />
        <h2>Não foi possível carregar o ambiente</h2>
        <p>{environmentError}</p>
        <div className="actions">
          <button className="btn primary" onClick={reload}>
            Tentar novamente
          </button>
          <button
            className="btn"
            onClick={async () => {
              try {
                await api("/auth/logout", { method: "POST" });
              } catch {}
              setUser(null);
            }}
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  if (!meta) return <div className="empty">Carregando ambiente...</div>;
  const nav = [
    ["dashboard", "Visão geral", LayoutDashboard],
    ["tests", "Testes", ClipboardCheck],
    ["bugs", "Bugs", BugIcon],
    ["settings", "Configurações", Settings],
  ];
  return (
    <div className={`app refinedApp ${collapsed ? "menuCollapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand brandWithToggle">
          <b className="brandMark">
            <ShieldCheck size={19} />
          </b>
          <span>QA Manager</span>
          <button
            className="sidebarToggle"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            onClick={toggle}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
        <nav className="nav">
          {nav.map(([id, text, Icon]: any) => (
            <button
              key={id}
              title={text}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              <span>{text}</span>
              {id === "bugs" && bugAlerts > 0 && (
                <b className="navBadge">{bugAlerts > 9 ? "9+" : bugAlerts}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="userCard">
          <strong>{user.name}</strong>
          <br />
          <small>{user.profileName || labels.role[user.role]}</small>
          <button
            className="btn logout"
            onClick={async () => {
              await api("/auth/logout", { method: "POST" });
              setUser(null);
            }}
          >
            <LogOut size={15} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
      <main className="main">
        {page === "dashboard" && <Dashboard meta={meta} />}{" "}
        {page === "tests" && (
          <TestsPage meta={meta} user={user} notice={notice} />
        )}{" "}
        {page === "bugs" && (
          <BugsPage user={user} meta={meta} notice={notice} />
        )}{" "}
        {page === "settings" && (
          <SettingsPage
            meta={meta}
            reload={reload}
            user={user}
            notice={notice}
          />
        )}
      </main>
      {message && <div className="toast">{message}</div>}
    </div>
  );
}
