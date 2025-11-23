# n8n-nodes-context-provider-tools

Este nó transforma textos estáticos em **Ferramentas de IA (AI Tools)** dinâmicas.

Ele permite que você crie uma "biblioteca de conhecimento" (regras de negócio, FAQs, snippets de código, personas) que seu Agente de IA pode consultar **apenas quando necessário**, em vez de sobrecarregar o System Prompt com todo o texto de uma vez.

![n8n-logo](https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png)

## 🧠 O problema que ele resolve

Normalmente, para dar contexto a uma IA, você cola todo o texto no *System Prompt*. Isso tem problemas:
1.  **Gasto de Tokens:** Você paga por todo o texto a cada execução, mesmo se a IA não usar.
2.  **Confusão:** Muito texto pode confundir o modelo sobre qual regra seguir.

**A Solução deste Nó:**
Ele cria uma **Tool (Ferramenta)**. O Agente de IA "sabe" que essa ferramenta existe e tem acesso a informações. Quando o usuário faz uma pergunta específica, o Agente decide: *"Preciso consultar a ferramenta 'obter_contexto' para responder isso"*.

---

## 🚀 Funcionalidades

*   **Busca Semântica Simplificada:** O Agente busca por palavras-chave (ex: "reembolso") e o nó encontra o contexto correto, mesmo que o nome seja "politica_de_devolucao".
*   **Modo "Tudo":** Se o Agente pedir "tudo" ou "all", a ferramenta retorna todos os contextos (útil para resumos).
*   **Flexibilidade:** Funciona com qualquer Agente compatível com LangChain no n8n (OpenAI Agent, ReAct Agent, etc).

---

## 🛠️ Como Configurar (Modo Agente)

1.  **Adicione o Nó:** Procure por "Provedor de Contexto".
2.  **Defina os Contextos:**
    *   *Exemplo 1:*
        *   **Nome:** `politica_reembolso`
        *   **Conteúdo:** "O reembolso só é permitido em até 7 dias..."
    *   *Exemplo 2:*
        *   **Nome:** `horario_atendimento`
        *   **Conteúdo:** "Segunda a Sexta, das 09h às 18h."
3.  **Configure o Modo de Saída:** Selecione `Ferramenta de Agente IA`.
4.  **Conecte ao Agente:** Ligue a saída deste nó na entrada **Tools** do seu nó de Agente (ex: *AI Agent* ou *OpenAI Chat Model* configurado com tools).

---

## 🤔 Exemplo de Interação (O que acontece nos bastidores)

Imagine que você configurou o contexto de `politica_reembolso` acima.

1.  **Usuário diz:** "Quero meu dinheiro de volta, comprei ontem."
2.  **Cérebro do Agente (Reasoning):**
    *   *"O usuário quer dinheiro de volta."*
    *   *"Eu não sei as regras de cabeça, mas tenho uma ferramenta chamada `obter_contexto`."*
    *   *Ação: Chamar `obter_contexto` com o termo "reembolso".*
3.  **Nó Provedor de Contexto:** Recebe o termo "reembolso", procura na lista e encontra `politica_reembolso`. Retorna o texto: "O reembolso só é permitido em até 7 dias..."
4.  **Agente Responde:** "Claro, como você comprou ontem e nossa política permite devolução em até 7 dias, podemos prosseguir."

---

## 📦 Instalação

### Via Gerenciador de Nós (Community Nodes)

No seu n8n:
1.  Vá em **Settings > Community Nodes**.
2.  Clique em **Install**.
3.  Digite: `n8n-nodes-context-provider-lucas-tools`

---

## 💻 Comandos Úteis (Desenvolvimento)

Se você está editando o código localmente:

```bash
# Instalar dependências
npm install

# Compilar o código
npm run build

# Publicar no NPM (Lembre de subir a versão no package.json)
npm publish --access public
```

## 📄 Licença

MIT