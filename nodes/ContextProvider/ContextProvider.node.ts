import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
} from 'n8n-workflow';

// Importação atualizada para LangChain e Zod
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import Fuse from 'fuse.js';

interface ValidationRule {
	campo: string;
	regex: string;
	mensagem_erro: string;
}

interface BehaviorScenario {
	tipo_lead: string;
	exemplos_entrada: string[];
	como_responder: string;
	exemplo_resposta: string;
}

interface FlowStep {
	etapa_id: string;
	etapa_numero: number;
	nome: string;
	objetivo_resumido: string;
	instrucoes_para_ia: string;
	campos_obrigatorios: string[];
	regras_validacao: ValidationRule[];
	comportamentos_esperados: BehaviorScenario[];
	tools_disponiveis_nesta_etapa: string[];
	proxima_etapa_id: string;
}

interface BotIdentity {
	bot_nome: string;
	tom_voz: string;
	personalidade: string;
}

// Helper para injetar variáveis de contexto no texto (Prompt Dinâmico)
function injectContext(text: any, context: Record<string, any>): string {
	// Conversão segura para string e verificação de nulos
	if (text === null || text === undefined) return '';
	const textStr = String(text);

	if (!context || typeof context !== 'object' || Object.keys(context).length === 0) {
		return textStr;
	}

	// Substitui {variavel} pelo valor em context['variavel']
	return textStr.replace(/{([a-zA-Z0-9_]+)}/g, (match, key) => {
		const val = context[key];
		if (val !== undefined && val !== null) {
			return String(val);
		}
		// Se não encontrar, mantém o original para indicar falta de dado ou alucinação controlada
		return match;
	});
}

// Helper para extrair dados do nó, lidando com a estrutura complexa do n8n
function getStepsFromInput(itemIndex: number, node: IExecuteFunctions | ISupplyDataFunctions): { steps: FlowStep[], identity: BotIdentity } {
	// 1. Obter Contexto Dinâmico de forma segura
	let contextData: Record<string, any> = {};
	try {
		const rawContext = node.getNodeParameter('contextData', itemIndex, {}) as any;
		if (rawContext && typeof rawContext === 'object' && !Array.isArray(rawContext)) {
			contextData = rawContext;
		}
	} catch (e) {
		// Fallback silencioso se falhar parsing
		contextData = {};
	}

	// 2. Processar Identidade com Injeção e conversão para string
	const botName = injectContext(node.getNodeParameter('botName', itemIndex, 'Bot'), contextData);
	const botTone = injectContext(node.getNodeParameter('botTone', itemIndex, ''), contextData);
	const botPersonality = injectContext(node.getNodeParameter('botPersonality', itemIndex, ''), contextData);

	const stepsData = node.getNodeParameter('steps', itemIndex) as { step?: Array<any> };
	const steps: FlowStep[] = [];

	if (stepsData && stepsData.step) {
		for (const s of stepsData.step) {
			// Processar comportamentos aninhados
			const behaviors: BehaviorScenario[] = [];
			if (s.behaviors && s.behaviors.scenario) {
				for (const b of s.behaviors.scenario) {
					behaviors.push({
						tipo_lead: injectContext(b.leadType, contextData),
						exemplos_entrada: (b.inputExamples || '').split(',').map((xE: string) => injectContext(String(xE).trim(), contextData)).filter((xE: string) => xE),
						como_responder: injectContext(b.responseStrategy, contextData),
						exemplo_resposta: injectContext(b.responseExample, contextData)
					});
				}
			}

			// Processar regras de validação aninhadas
			const validations: ValidationRule[] = [];
			if (s.validationRules && s.validationRules.rule) {
				for (const v of s.validationRules.rule) {
					validations.push({
						campo: v.field || '',
						regex: v.regexPattern || '',
						mensagem_erro: injectContext(v.errorMessage, contextData)
					});
				}
			}

			steps.push({
				etapa_id: s.stepId ? String(s.stepId).toLowerCase().trim() : '',
				etapa_numero: s.stepOrder as number,
				nome: injectContext(s.stepName, contextData),
				objetivo_resumido: injectContext(s.stepObjective, contextData),
				instrucoes_para_ia: injectContext(s.stepInstructions, contextData),
				campos_obrigatorios: (s.requiredFields || '').split(',').map((f: string) => f.trim()).filter((f: string) => f),
				regras_validacao: validations,
				tools_disponiveis_nesta_etapa: (s.allowedTools || '').split(',').map((t: string) => t.trim()).filter((t: string) => t),
				proxima_etapa_id: s.nextStepId ? String(s.nextStepId) : '',
				comportamentos_esperados: behaviors
			});
		}
	}

	return {
		steps,
		identity: {
			bot_nome: botName,
			tom_voz: botTone,
			personalidade: botPersonality
		}
	};
}

// Lógica de Busca Inteligente ("Did you mean?")
function findSmartMatch(input: string, steps: FlowStep[]): { found: FlowStep | null, message?: string } {
	if (!input || typeof input !== 'string') return { found: null, message: 'ID inválido.' };
	
	const searchId = input.toLowerCase().trim();
	if (!searchId) return { found: null, message: 'ID vazio.' };
	
	// 1. Tentativa de Match Exato (Prioridade Máxima)
	const exactMatch = steps.find(s => s.etapa_id === searchId);
	if (exactMatch) return { found: exactMatch };

	// 2. Configuração do Fuse.js para busca aproximada
	const fuse = new Fuse(steps, {
		keys: ['etapa_id', 'nome'], // Busca no ID e no Nome de display
		includeScore: true,
		threshold: 0.4, // 0.0 = exato, 1.0 = match muito vago. 0.4 é seguro.
		ignoreLocation: true, // Ignora a posição exata da string (bom para typos)
	});

	const results = fuse.search(searchId);

	if (results.length > 0) {
		const bestMatch = results[0];
		const score = bestMatch.score || 1;

		// 3. Auto-Correção (Score muito baixo significa muita semelhança, ex: "abrtura" -> "abertura")
		// Ajustado para 0.2 para ser conservador na auto-correção direta
		if (score < 0.2) {
			return { found: bestMatch.item };
		}

		// 4. Sugestão de Erro (Score mediano, ex: "vendas" vs "venda")
		// Retorna null no found, mas preenche a message com a sugestão para a IA
		return { 
			found: null, 
			message: `Erro: O ID '${searchId}' não existe. Você quis dizer '${bestMatch.item.etapa_id}'?`
		};
	}

	return { found: null };
}

// Helper para limpar campos vazios do JSON (Token Optimization)
function cleanOutput(obj: any): any {
	if (obj === null || obj === undefined || obj === '') return undefined;
	
	if (Array.isArray(obj)) {
		const cleaned = obj.map(cleanOutput).filter(v => v !== undefined);
		return cleaned.length > 0 ? cleaned : undefined;
	}
	
	if (typeof obj === 'object') {
		const newObj: any = {};
		let hasKeys = false;
		for (const key in obj) {
			const val = cleanOutput(obj[key]);
			if (val !== undefined) {
				newObj[key] = val;
				hasKeys = true;
			}
		}
		return hasKeys ? newObj : undefined;
	}
	
	return obj;
}

export class ContextProvider implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Chatbot Flow Manager',
		name: 'contextProvider',
		icon: 'file:contextProviderTool.svg',
		group: ['tools'] as any,
		usableAsTool: true,
		version: 1,
		description: 'Gerencia o fluxo, personalidade e regras de comportamento do Chatbot',
		defaults: {
			name: 'Flow Manager',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			// ============================================================
			// SEÇÃO 1: MODO DE OPERAÇÃO
			// ============================================================
			{
				displayName: 'SEÇÃO 1: Modo de Operação',
				name: 'headerMode',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Modo de Operação',
				name: 'outputMode',
				type: 'options',
				options: [
					{
						name: 'Ferramenta de Agente IA (Produção)',
						value: 'aiTool',
						description: 'Gera a tool "buscar_instrucoes_etapa" para o Agente',
					},
					{
						name: 'Testar Busca Manualmente (Debug)',
						value: 'test',
						description: 'Simule o retorno do JSON buscando um ID aqui no editor',
					},
				],
				default: 'aiTool',
			},
			{
				displayName: 'ID para Teste',
				name: 'testStepId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						outputMode: ['test'],
					},
				},
				placeholder: 'ex: abertura',
				description: 'Digite um ID de etapa para ver o JSON que a IA receberia',
			},

			// ============================================================
			// SEÇÃO 1.5: CONTEXTO DINÂMICO
			// ============================================================
			{
				displayName: 'SEÇÃO 1.5: Contexto Dinâmico',
				name: 'headerContext',
				type: 'notice',
				default: 'Injete dados do workflow nas instruções usando {variavel}.',
			},
			{
				displayName: 'Dados de Contexto (JSON)',
				name: 'contextData',
				type: 'json',
				default: '{}',
				placeholder: 'ex: {{ $json }}',
				description: 'Objeto com os dados para substituir. Se você usar "{nome}" nas instruções e passar { "nome": "Maria" } aqui, a IA receberá "Maria".',
			},

			// ============================================================
			// SEÇÃO 2: IDENTIDADE E TOM DE VOZ
			// ============================================================
			{
				displayName: 'SEÇÃO 2: Identidade e Personalidade',
				name: 'headerPersona',
				type: 'notice',
				default: 'Defina quem é o bot. Isso será enviado junto com cada etapa.',
			},
			{
				displayName: 'Nome do Bot',
				name: 'botName',
				type: 'string',
				default: 'Manu',
				placeholder: 'ex: Manu',
			},
			{
				displayName: 'Tom de Voz',
				name: 'botTone',
				type: 'string',
				default: 'Calorosa, profissional e proativa',
				placeholder: 'ex: Amigável e direto',
			},
			{
				displayName: 'Personalidade Detalhada',
				name: 'botPersonality',
				type: 'string',
				default: '',
				typeOptions: { rows: 3 },
				placeholder: 'ex: Você adora ajudar. Use emojis ocasionalmente.',
				description: 'Diretrizes globais de comportamento',
			},

			// ============================================================
			// SEÇÃO 3: ETAPAS DO FLUXO
			// ============================================================
			{
				displayName: 'SEÇÃO 3: Etapas do Fluxo',
				name: 'headerSteps',
				type: 'notice',
				default: 'Configure a lógica de cada momento da conversa.',
			},
			{
				displayName: 'Etapas',
				name: 'steps',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
					sortable: true,
				},
				default: {},
				placeholder: 'Adicionar Etapa',
				options: [
					{
						displayName: 'Configuração da Etapa',
						name: 'step',
						values: [
							{
								displayName: 'ID da Etapa',
								name: 'stepId',
								type: 'string',
								default: '',
								placeholder: 'ex: abertura',
								description: 'Identificador único usado pela IA para buscar esta etapa',
								required: true,
							},
							{
								displayName: 'Número da Etapa',
								name: 'stepOrder',
								type: 'number',
								default: 1,
							},
							{
								displayName: 'Nome Display',
								name: 'stepName',
								type: 'string',
								default: '',
								placeholder: 'ex: Abertura',
							},
							{
								displayName: 'Objetivo Resumido',
								name: 'stepObjective',
								type: 'string',
								default: '',
								description: 'O que a IA deve conseguir nesta etapa',
							},
							{
								displayName: 'Instruções para IA',
								name: 'stepInstructions',
								type: 'string',
								default: '',
								typeOptions: { rows: 4 },
								description: 'O "Prompt" específico desta etapa. Use {variavel} para dados dinâmicos.',
							},
							{
								displayName: 'Campos Obrigatórios',
								name: 'requiredFields',
								type: 'string',
								default: '',
								placeholder: 'ex: nome, email (separar por vírgula)',
								description: 'Lista de dados a coletar',
							},
							// NESTED COLLECTION: Regras de Validação
							{
								displayName: 'Regras de Validação (Regex)',
								name: 'validationRules',
								type: 'fixedCollection',
								typeOptions: {
									multipleValues: true,
									sortable: true,
								},
								default: {},
								placeholder: 'Add Regra',
								description: 'Defina validações técnicas para os campos desta etapa',
								options: [
									{
										displayName: 'Regra',
										name: 'rule',
										values: [
											{
												displayName: 'Campo a Validar',
												name: 'field',
												type: 'string',
												default: '',
												placeholder: 'ex: cpf',
											},
											{
												displayName: 'Expressão Regular (Regex)',
												name: 'regexPattern',
												type: 'string',
												default: '',
												placeholder: 'ex: ^\\d{11}$',
												description: 'O padrão que o texto deve seguir',
											},
											{
												displayName: 'Mensagem de Erro',
												name: 'errorMessage',
												type: 'string',
												default: '',
												placeholder: 'ex: O CPF deve conter apenas 11 dígitos.',
												description: 'O que a IA deve dizer se a validação falhar',
											},
										],
									},
								],
							},
							{
								displayName: 'Tools Disponíveis Nesta Etapa',
								name: 'allowedTools',
								type: 'string',
								default: '',
								placeholder: 'ex: agendar_visita, consultar_cpf',
								description: 'Nomes das outras tools que a IA pode chamar agora',
							},
							{
								displayName: 'ID da Próxima Etapa',
								name: 'nextStepId',
								type: 'string',
								default: '',
								placeholder: 'ex: diagnostico',
								description: 'Para onde a IA deve ir após cumprir o objetivo',
							},
							// NESTED COLLECTION: Comportamentos Esperados
							{
								displayName: 'Comportamentos Esperados (Cenários)',
								name: 'behaviors',
								type: 'fixedCollection',
								typeOptions: {
									multipleValues: true,
									sortable: true,
								},
								default: {},
								placeholder: 'Add Cenário',
								description: 'Exemplos de como lidar com diferentes inputs do usuário',
								options: [
									{
										displayName: 'Cenário',
										name: 'scenario',
										values: [
											{
												displayName: 'Tipo de Lead/Situação',
												name: 'leadType',
												type: 'string',
												default: 'Genérico',
											},
											{
												displayName: 'Exemplos de Entrada',
												name: 'inputExamples',
												type: 'string',
												default: '',
												placeholder: 'Oi, Olá (separar por vírgula)',
											},
											{
												displayName: 'Estratégia de Resposta',
												name: 'responseStrategy',
												type: 'string',
												default: '',
												placeholder: 'Seguir script padrão',
											},
											{
												displayName: 'Exemplo de Resposta Ideal',
												name: 'responseExample',
												type: 'string',
												default: '',
												typeOptions: { rows: 2 },
											},
										],
									},
								],
							},
						],
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<any> {
		const { steps, identity } = getStepsFromInput(itemIndex, this);

		// Usando DynamicStructuredTool com Zod Schema para estrutura robusta
		const tool = new DynamicStructuredTool({
			name: 'buscar_instrucoes_etapa',
			description: 'CRÍTICO: Use esta ferramenta para obter instruções de COMO agir. Retorna um JSON com o roteiro.',
			schema: z.object({
				step_id: z.string().describe('O ID único da etapa que você deseja buscar (ex: "abertura").'),
			}),
			func: async ({ step_id }) => {
				if (!step_id) return "Erro: Forneça um ID de etapa válido.";
				
				// Executa busca inteligente (Fuzzy + Exact + Did You Mean)
				const { found, message } = findSmartMatch(step_id, steps);

				if (found) {
					const response = {
						status: "success",
						modo_operacao: "Agente Ativo", 
						identidade_bot: identity,
						
						etapa_atual: {
							etapa_id: found.etapa_id,
							etapa_numero: found.etapa_numero,
							nome: found.nome,
							objetivo_resumido: found.objetivo_resumido,
							instrucoes_para_ia: found.instrucoes_para_ia,
							campos_obrigatorios: found.campos_obrigatorios,
							regras_validacao: found.regras_validacao, // Inclui as regras no output
							comportamentos_esperados: found.comportamentos_esperados,
							tools_disponiveis: found.tools_disponiveis_nesta_etapa,
							proxima_etapa_id: found.proxima_etapa_id
						}
					};
					// Token Optimization: Remove empty fields
					const optimizedResponse = cleanOutput(response);
					return JSON.stringify(optimizedResponse, null, 2);
				}

				// Gera mensagem de erro com sugestão e lista completa
				const available = steps.map(s => `"${s.etapa_id}"`).join(', ');
				const errorMsg = message ? message : `Erro: O ID '${step_id}' não existe no fluxo.`;
				
				return `${errorMsg} IDs disponíveis: ${available}.`;
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
				const outputMode = this.getNodeParameter('outputMode', itemIndex) as string;
				const { steps, identity } = getStepsFromInput(itemIndex, this);

				if (outputMode === 'aiTool') {
					returnData.push({
						json: {
							message: "Tool 'Chatbot Flow Manager' configurada com sucesso (Structured Mode).",
							bot_identity: identity,
							steps_count: steps.length,
							steps_ids: steps.map(s => s.etapa_id)
						},
						pairedItem: { item: itemIndex },
					});
				} 
				else if (outputMode === 'test') {
					const testId = this.getNodeParameter('testStepId', itemIndex, '') as string;
					const { found, message } = findSmartMatch(testId, steps);

					if (found) {
						const previewJson = {
							status: "success",
							identidade_bot: identity,
							etapa_atual: {
								etapa_id: found.etapa_id,
								etapa_numero: found.etapa_numero,
								nome: found.nome,
								objetivo_resumido: found.objetivo_resumido,
								instrucoes_para_ia: found.instrucoes_para_ia,
								campos_obrigatorios: found.campos_obrigatorios,
								regras_validacao: found.regras_validacao,
								comportamentos_esperados: found.comportamentos_esperados,
								tools_disponiveis: found.tools_disponiveis_nesta_etapa,
								proxima_etapa_id: found.proxima_etapa_id
							}
						};

						returnData.push({
							json: {
								found: true,
								match_type: found.etapa_id === testId.toLowerCase().trim() ? 'exact' : 'fuzzy_auto_corrected',
								preview_json: cleanOutput(previewJson)
							},
							pairedItem: { item: itemIndex },
						});
					} else {
						returnData.push({
							json: {
								found: false,
								message: message || `Etapa '${testId}' não encontrada.`,
								available_ids: steps.map(s => s.etapa_id)
							},
							pairedItem: { item: itemIndex },
						});
					}
				}

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
