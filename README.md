# n8n-nodes-context-provider

Este é um nó personalizado do **n8n** que permite criar, gerenciar e recuperar múltiplos contextos de texto. Ele foi projetado especificamente para auxiliar **Agentes de IA** (AI Agents) a recuperarem informações contextuais (regras de negócio, personas, documentação) de forma dinâmica.

![n8n-logo](https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png)

## 🚀 Funcionalidades

*   **Múltiplos Contextos:** Defina vários blocos de texto com nomes únicos (ex: `vendas_faq`, `tom_de_voz`, `tabela_precos`).
*   **Recuperação Semântica (Simples):** O agente pode solicitar um contexto pelo nome exato.
*   **Injeção Total:** Pode retornar todos os contextos de uma vez para popular o System Prompt de um LLM.

---

## 📦 Instalação

### Via Community Nodes (Recomendado)

Depois de publicado no NPM, siga estes passos na sua instância do n8n:

1.  Vá em **Settings > Community Nodes**.
2.  Selecione **Install**.
3.  Procure pelo nome do pacote (ex: `n8n-nodes-context-provider`).
4.  Clique em **Install**.

---

## 💻 Como Publicar (Windows/Local)

Se você baixou os arquivos para seu computador (ex: pasta Downloads):

1.  Instale o [Node.js](https://nodejs.org/).
2.  Abra o terminal (PowerShell ou CMD).
3.  Entre na pasta do projeto:
    ```powershell
    cd C:\Caminho\Para\A\Pasta
    ```
4.  Instale as dependências:
    ```powershell
    npm install
    ```
5.  Faça login e publique:
    ```powershell
    npm login
    npm publish --access public
    ```
    *(Nota: Se der erro de nome já existente, mude o "name" no arquivo package.json)*

---

## 💡 Como Usar

### Cenário 1: Agente de IA Autônomo
Use este nó como uma **Tool** (Ferramenta) para o seu Agente.

1.  Adicione o nó **Provedor de Contexto**.
2.  Configure o **Modo de Saída** como `Retornar por Nome`.
3.  Preencha os contextos (ex: Nome: `suporte`, Conteúdo: `Regras de suporte...`).
4.  Conecte este nó a um nó de "Tool" ou deixe o Agente chamá-lo se estiver configurado como ferramenta customizada.

### Cenário 2: Enriquecimento de Prompt
Antes de chamar o nó da OpenAI/LangChain:

1.  Use o **Provedor de Contexto** no início do fluxo.
2.  Configure o **Modo de Saída** como `Retornar Todos os Contextos`.
3.  No nó da OpenAI, no campo System Prompt, use a expressão:
    ```javascript
    {{ $json.contextsMap }}
    ```

## 📄 Licença

MIT