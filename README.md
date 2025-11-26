# Chatbot Flow Manager (n8n-nodes-context-provider-tools)

Este nó transforma o n8n em um **Gerenciador de Fluxo de Chatbot Profissional**. Ele permite definir roteiros complexos, validar dados com Regex e injetar variáveis dinâmicas nas instruções, fornecendo uma **Ferramenta de IA (AI Tool)** robusta para que seu Agente saiba exatamente como agir.

![n8n-logo](https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png)

## 📋 Informações Básicas

*   **Nome do Pacote:** `n8n-nodes-context-provider-tools`
*   **Nome no n8n:** Chatbot Flow Manager
*   **Nome da Tool (para a IA):** `buscar_instrucoes_etapa`

---

## 🚀 Funcionalidades Principais

1.  **Roteiro Estruturado (Flow Control):**
    *   Defina etapas claras (Abertura, Qualificação, Venda).
    *   A IA recebe apenas o contexto necessário para o momento atual.

2.  **Contexto Dinâmico (Dynamic Prompts):**
    *   Injete dados do workflow (nome, saldo, produto) diretamente nas instruções usando `{variavel}`.
    *   *Exemplo:* "O cliente se chama {nome} e tem interesse em {produto}."

3.  **Validação Técnica (Regex):**
    *   Defina regras de validação (CPF, E-mail, Telefone) dentro do nó.
    *   A tool retorna a regra para a IA, permitindo que ela valide o input do usuário localmente antes de chamar uma API.

4.  **Busca Inteligente & Auto-Correção:**
    *   Se a IA pedir um ID errado (ex: "abertur"), o nó corrige automaticamente ou sugere: "Erro: ID não existe. Você quis dizer 'abertura'?".
    *   Isso cria um ciclo de auto-cura (self-healing) no chat.

5.  **Economia de Tokens:**
    *   O nó remove automaticamente campos vazios ou nulos do JSON antes de enviar para a IA, reduzindo custos e latência.

---

## 🛠️ Guia de Configuração

### Passo 1: Contexto Dinâmico
Para usar variáveis nas suas instruções:
1.  Na **SEÇÃO 1.5**, no campo **Dados de Contexto**, mapeie seus dados (geralmente `{{ $json }}`).
2.  Nas instruções das etapas, use chaves para referenciar as variáveis: `{nome}`, `{email}`, `{pedido_id}`.

### Passo 2: Configurando as Etapas
1.  Em **Etapas do Fluxo**, clique em *Add Etapa*.
2.  Preencha os campos principais:
    *   **ID da Etapa:** Identificador único (ex: `captura_email`).
    *   **Instruções:** O que a IA deve fazer. Ex: "Pergunte o e-mail para {nome}."
    *   **Regras de Validação:** Clique em *Add Regra* para configurar validações técnicas (ex: Regex de e-mail).

### Passo 3: Conectando ao Agente de IA
1.  Conecte a saída do nó **Chatbot Flow Manager** na entrada **Tools** do seu Agente de IA (LangChain/OpenAI).
2.  **System Prompt Obrigatório:** Cole o seguinte comando no prompt do seu agente:

> "Você é um assistente virtual inteligente.
> **REGRA DE OURO:** Para saber o que falar, você DEVE usar a ferramenta `buscar_instrucoes_etapa`.
> 1. Comece buscando o ID 'abertura' (ou o ID da sua primeira etapa).
> 2. Siga estritamente as instruções, objetivos e validações retornadas pela ferramenta.
> 3. Se a ferramenta retornar uma regra de validação (regex), verifique a resposta do usuário antes de aceitar o dado."

---

## 💡 Exemplos de Uso

### Cenário 1: Validação de CPF
*   **Configuração na Tool:**
    *   Campo: `cpf`
    *   Regex: `^\d{11}$`
    *   Mensagem de Erro: "Por favor {nome}, digite um CPF válido com 11 números."
*   **Comportamento:** A IA receberá essa regra e, se o usuário digitar "123", ela responderá com a mensagem de erro configurada sem precisar consultar um backend.

### Cenário 2: Atendimento Personalizado
*   **Contexto (Input do n8n):** `{ "cliente": "Maria", "ultima_compra": "Sapato Azul" }`
*   **Instrução na Tool:** "Pergunte se a {cliente} gostou do {ultima_compra}."
*   **O que a IA Vê:** "Pergunte se a Maria gostou do Sapato Azul."

---

## ⚠️ Solução de Problemas

1.  **A IA não usa a ferramenta:**
    *   Verifique se a tool está conectada.
    *   Reforce no System Prompt: "Não invente respostas, use a tool `buscar_instrucoes_etapa`".

2.  **Variáveis não aparecem (`{nome}` fica vazio):**
    *   Verifique se você mapeou o JSON corretamente no campo "Dados de Contexto".
    *   Verifique se o nome da variável no JSON é exatamente igual ao que está entre chaves (case-sensitive).

3.  **Erro "Etapa não encontrada":**
    *   A busca inteligente tentará corrigir erros de digitação, mas se o ID for muito diferente, verifique a lista de IDs disponíveis retornada na mensagem de erro.

---

## 📄 Licença
MIT