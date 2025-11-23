import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

interface Context {
	name: string;
	content: string;
}

export class ContextProvider implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Provedor de Contexto',
		name: 'contextProvider',
		icon: 'file:contextProvider.svg',
		group: ['transform'],
		version: 1,
		description: 'Fornece contextos dinâmicos em linguagem natural para agentes de IA',
		defaults: {
			name: 'Provedor de Contexto',
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
								description: 'Identificador único para este contexto',
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
						name: 'Retornar Todos os Contextos',
						value: 'all',
						description: 'Retorna um objeto contendo todos os contextos definidos',
					},
					{
						name: 'Retornar por Nome',
						value: 'byName',
						description: 'Filtra e retorna um contexto específico pelo nome',
					},
				],
				default: 'all',
			},
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const contextsData = this.getNodeParameter('contexts', itemIndex) as {
					context?: Array<{ contextName: string; contextContent: string }>;
				};
				const outputMode = this.getNodeParameter('outputMode', itemIndex) as string;
				const contextNameToSearch = this.getNodeParameter(
					'contextNameToSearch',
					itemIndex,
					'',
				) as string;

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

				if (outputMode === 'all') {
					// Retorna todos os contextos em um formato fácil para a IA consumir
					outputData = {
						contexts: contexts,
						// Cria um mapa chave-valor para busca fácil no JSON
						contextsMap: contexts.reduce(
							(acc, curr) => ({ ...acc, [curr.name]: curr.content }),
							{},
						),
						totalContexts: contexts.length,
					};
				} else if (outputMode === 'byName') {
					// Encontrar contexto específico
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