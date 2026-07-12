# Produto e fluxo de uso

## Objetivo

Substituir a planilha de testes manuais por uma aplicação local mais rápida, sem aumentar a burocracia. O QA é o usuário principal; desenvolvedores e gestores têm interação pontual.

## Fluxo principal

1. Na tela **Testes**, selecionar **Novo teste**.
2. Informar data, ciclo e resultado junto com o cenário.
3. Preencher passos em linhas separadas e o resultado esperado.
4. Se o resultado for **Passou**, salvar e encerrar.
5. Se for **Falhou**, preencher descrição, severidade, prioridade e desenvolvedor do bug.
6. Usar **Salvar e criar próximo** em sessões de execução contínua.

## Recursos de produtividade

- `Ctrl + Enter` salva o formulário aberto.
- Modelos padrão e pessoais preenchem cenários recorrentes.
- Modelos podem ser criados, renomeados e apagados em Configurações > Cadastros; ficam no banco local e aparecem em todos os navegadores conectados ao sistema.
- Ciclos, módulos e tipos podem ser criados e removidos da seleção em Configurações sem quebrar testes históricos.
- Resultado pode ser atualizado na própria tabela; selecionar Falhou abre o formulário para exigir os detalhes do bug.
- Mudanças de status e novas anotações geram badge no menu Bugs, aviso visual e som local.
- Tabelas podem ser deslocadas horizontalmente clicando e arrastando áreas não interativas.
- Colunas opcionais permitem alternar entre visão compacta e detalhada.
- **Salvar filtros** mantém a visão favorita no navegador.
- Duplicar copia somente a definição do caso, com um novo ID.
- Exclusão confirmada remove também execuções, bugs, comentários e evidências vinculadas.
- No formulário de bug, é possível colar links de evidência (ex.: Google Drive), um por linha, em vez de fazer upload do arquivo. Aparecem como links clicáveis na tela Bugs.
- A tela Testes mostra um histórico de estabilidade por caso (uma bolinha por ciclo já executado) e sinaliza "⚠ Instável" quando o mesmo caso alterna entre Passou e Falhou em ciclos diferentes — ajuda a distinguir bug real de teste flaky.

## Perfis de acesso

O administrador cria perfis com qualquer nome e combina as permissões de testes, bugs, configurações, usuários e exportações. Os quatro perfis iniciais são apenas dados demonstrativos e podem ser editados.

## Fora do escopo atual

- Automação de testes, Jira, GitHub, Slack e notificações.
- Multiempresa ou múltiplos projetos visíveis.
- Aplicativo móvel nativo.
- Hospedagem e autenticação corporativa.
