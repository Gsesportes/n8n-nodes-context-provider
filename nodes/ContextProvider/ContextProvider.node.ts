import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	ISupplyDataFunctions,
} from 'n8n-workflow';

// Importação dinâmica para evitar erros de build se a lib não for carregada corretamente no ambiente n8n padrão,
// mas necessária para tipagem se possível. No runtime do n8n, o langchain geralmente está disponível,
// mas aqui garantimos que o pacote 'langchain' esteja no package.json.
import { DynamicTool } from 'langchain/tools';

interface Context {
	name: string;
	content: string;
}

export class ContextProvider implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Context Tool',
		name: 'contextProvider',
		icon: 'file:contextProviderTool.svg',
		// @ts-ignore: 'tools' group might not be in the strict INodeTypeDescription definition yet, but is required for tools
		group: ['tools'] as any,
		usableAsTool: true,
		version: 1,
		description: 'Fornece contextos dinâmicos em linguagem natural para agentes de IA',
		defaults: {
			name: 'Context Tool',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Contextos',
				name: 'contexts',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				placeholder: 'Adicionar contextos',
				options: [
					{
						displayName: 'Item de Contexto',
						name: 'context',
						values: [
							{
								displayName: 'Nome',
								name: 'contextName',
								type: 'string',
								default: '',
								placeholder: 'ex: contexto_onboarding',
								description: 'Identificador único para este contexto (será usado pelo Agente para buscar)',
								required: true,
							},
							{
								displayName: 'Conteúdo',
								name: 'contextContent',
								type: 'string',
								default: '',
								typeOptions: {
									rows: 5,
								},
								placeholder: 'Escreva o contexto em linguagem natural aqui...',
								description: 'O texto de contexto real para a IA',
								required: true,
							},
						],
					},
				],
			},
			{
				displayName: 'Modo de Saída',
				name: 'outputMode',
				type: 'options',
				options: [
					{
						name: 'Ferramenta de Agente IA',
						value: 'aiTool',
						description: 'Gera uma Tool que pode ser conectada a um Agente de IA',
					},
					{
						name: 'Retornar Todos os Contextos (JSON)',
						value: 'all',
						description: 'Retorna um objeto JSON contendo todos os contextos definidos',
					},
					{
						name: 'Retornar por Nome (Busca)',
						value: 'byName',
						description: 'Filtra e retorna um contexto específico pelo nome agora',
					},
				],
				default: 'aiTool',
			},
			// Configurações da Ferramenta (Aparecem apenas no modo aiTool)
			{
				displayName: 'Nome da Ferramenta',
				name: 'toolName',
				type: 'string',
				default: 'obter_contexto',
				displayOptions: {
					show: {
						outputMode: ['aiTool'],
					},
				},
				description: 'Nome da função que o Agente vai chamar. Use letras minúsculas e underline (ex: buscar_regras).',
			},
			{
				displayName: 'Descrição da Ferramenta',
				name: 'toolDescription',
				type: 'string',
				default: 'Use esta ferramenta para buscar informações específicas de contexto, regras ou documentação. O input deve ser o nome do contexto desejado.',
				displayOptions: {
					show: {
						outputMode: ['aiTool'],
					},
				},
				description: 'Instrução para o Agente saber QUANDO usar esta ferramenta.',
			},
			// Configuração de Busca (Aparece apenas no modo byName)
			{
				displayName: 'Nome do Contexto para Buscar',
				name: 'contextNameToSearch',
				type: 'string',
				default: '',
				placeholder: 'ex: contexto_onboarding',
				displayOptions: {
					show: {
						outputMode: ['byName'],
					},
				},
				description: 'O nome exato do contexto que você deseja recuperar',
				required: true,
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<any> {
		const contextsData = this.getNodeParameter('contexts', itemIndex) as {
			context?: Array<{ contextName: string; contextContent: string }>;
		};
		const toolName = this.getNodeParameter('toolName', itemIndex, 'obter_contexto') as string;
		const toolDescription = this.getNodeParameter('toolDescription', itemIndex, '') as string;

		const contexts: Context[] = [];

		if (contextsData.context && Array.isArray(contextsData.context)) {
			for (const ctx of contextsData.context) {
				contexts.push({
					name: ctx.contextName,
					content: ctx.contextContent,
				});
			}
		}

		const tool = new DynamicTool({
			name: toolName,
			description: toolDescription,
			func: async (input: string) => {
				if (typeof input !== 'string') {
					return "Erro: O input deve ser um texto (string).";
				}
				const term = input.toLowerCase().trim();
				
				if (!term) {
					return "Erro: O termo de busca não pode ser vazio ou conter apenas espaços.";
				}
				
				if (term === 'all' || term === 'todos' || term === 'tudo' || term === 'lista') {
					return JSON.stringify(contexts.map(c => ({ nome: c.name, conteudo: c.content })));
				}

				const matches = contexts.filter(c => 
					c.name.toLowerCase().includes(term) || term.includes(c.name.toLowerCase())
				);
				
				if (matches.length === 1) {
					return matches[0].content;
				}
				if (matches.length > 1) {
					return `Encontrei múltiplos contextos relacionados a "${term}":\n\n` + 
							matches.map(c => `--- [${c.name}] ---\n${c.content}`).join('\n\n');
				}

				const availableNames = contexts.map(c => c.name).join(', ');
				return `Contexto não encontrado para o termo: "${input}". Contextos disponíveis: ${availableNames}`;
			},
		});

		return {
			response: tool,
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const contextsData = this.getNodeParameter('contexts', itemIndex) as {
					context?: Array<{ contextName: string; contextContent: string }>;
				};
				const outputMode = this.getNodeParameter('outputMode', itemIndex) as string;

				const contexts: Context[] = [];

				if (contextsData.context && Array.isArray(contextsData.context)) {
					for (const ctx of contextsData.context) {
						contexts.push({
							name: ctx.contextName,
							content: ctx.contextContent,
						});
					}
				}

				let outputData: any;

				if (outputMode === 'aiTool') {
					const toolName = this.getNodeParameter('toolName', itemIndex, 'obter_contexto') as string;
					const toolDescription = this.getNodeParameter('toolDescription', itemIndex, '') as string;

					// Criação da Ferramenta LangChain
					const tool = new DynamicTool({
						name: toolName,
						description: toolDescription,
						func: async (input: string) => {
							// Validação de input
							if (typeof input !== 'string') {
								return "Erro: O input para a busca de contexto deve ser um texto (string).";
							}

							const term = input.toLowerCase().trim();

							if (!term) {
								return "Erro: O termo de busca não pode ser vazio ou conter apenas espaços.";
							}

							// Tenta buscar "all" ou "todos"
							if (term === 'all' || term === 'todos' || term === 'tudo' || term === 'lista') {
								return JSON.stringify(contexts.map(c => ({ nome: c.name, conteudo: c.content })));
							}

							// Busca por inclusão (múltiplos resultados possíveis)
							// Ex: Busca "regras" encontra "regras_pagamento" e "regras_envio"
							const matches = contexts.filter(c => 
								c.name.toLowerCase().includes(term) || term.includes(c.name.toLowerCase())
							);
							
							if (matches.length === 1) {
								return matches[0].content;
							}

							if (matches.length > 1) {
								return `Encontrei múltiplos contextos relacionados a "${term}":\n\n` + 
									   matches.map(c => `--- [${c.name}] ---\n${c.content}`).join('\n\n');
							}

							const availableNames = contexts.map(c => c.name).join(', ');
							return `Contexto não encontrado para o termo: "${input}". Tente buscar por um destes nomes: ${availableNames}`;
						},
					});

					outputData = {
						tool_created: true,
						tool_name: toolName,
						tool: tool, // Propriedade reconhecida pelo Agente do n8n
					};

				} else if (outputMode === 'all') {
					outputData = {
						contexts: contexts,
						contextsMap: contexts.reduce(
							(acc, curr) => ({ ...acc, [curr.name]: curr.content }),
							{},
						),
						totalContexts: contexts.length,
					};
				} else if (outputMode === 'byName') {
					const contextNameToSearch = this.getNodeParameter('contextNameToSearch', itemIndex, '') as string;
					
					const foundContext = contexts.find(
						(c) => c.name.toLowerCase() === contextNameToSearch.toLowerCase().trim(),
					);

					if (!foundContext) {
						throw new NodeOperationError(
							this.getNode(),
							`Contexto "${contextNameToSearch}" não encontrado. Contextos disponíveis: ${contexts
								.map((c) => c.name)
								.join(', ')}`,
						);
					}

					outputData = {
						contextName: foundContext.name,
						contextContent: foundContext.content,
					};
				}

				returnData.push({
					json: outputData,
					pairedItem: {
						item: itemIndex,
					},
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}