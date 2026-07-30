Regras do jogo

Princípio

Jogo original de estratégia leve, administração e negociação de propriedades fictícias. De 2 a 6 jogadores percorrem uma rota temática e desenvolvem conjuntos regionais.

Configuração padrão

Jogadores: 2 a 6.

Saldo inicial sugerido: 1.500 créditos.

Tabuleiro inicial: 36 casas.

Dados: dois dados de seis faces gerados pelo servidor.

Bônus de volta: 200 créditos.

Turno: 60 segundos, configurável entre 30 e 180.

Vitória padrão: último jogador solvente.

Modo futuro: patrimônio após limite de rodadas.

Valores definitivos deverão ser calibrados por simulação e testes; não trate os números sugeridos como balanceamento final.

Estrutura do turno

TURN_STARTED.

Jogador pode resolver ações pré-lançamento permitidas.

Jogador solicita dados.

Servidor gera resultado.

Servidor calcula destino e passagem pelo início.

Cliente anima movimento confirmado.

Servidor resolve a casa.

Se necessário, abre decisão com prazo.

Jogador pode administrar propriedades e negociar, conforme regras.

Jogador encerra ou o tempo expira.

Servidor escolhe próximo jogador ativo.

Casas

START: início e bônus de volta.

PROPERTY: propriedade comprável.

TRANSPORT: ativo de transporte.

UTILITY: serviço regional fictício.

REGIONAL_EVENT: carta de evento.

COMMUNITY_BENEFIT: carta de benefício.

MUNICIPAL_FEE: taxa fictícia.

INSPECTION: envia para fiscalização temporária.

VISITING: casa neutra.

REST: descanso sem efeito financeiro.

MOVE: movimento controlado para outra casa.

Propriedades

Uma propriedade contém:

preço;

grupo;

aluguel por nível;

custo de melhoria;

nível máximo;

proprietário;

estado hipotecado;

descrição e apresentação visual.

Ao cair em propriedade livre, o jogador pode comprar ou recusar. No MVP, a recusa deixa a propriedade livre; leilão fica como regra opcional futura.

Ao cair em propriedade de outro jogador:

não há cobrança se estiver hipotecada;

o servidor calcula aluguel;

pagamento é transacional;

se o saldo for insuficiente, abre fase de liquidação.

Grupos e melhorias

Melhorias somente quando o jogador possui o grupo completo.

Níveis sugeridos: 0 a 4.

Construção equilibrada: diferença máxima de um nível dentro do grupo.

Venda ocorre em ordem equilibrada.

Propriedade hipotecada impede melhoria no grupo.

O custo e o aluguel vêm do conteúdo configurável.

Hipoteca

Jogador recebe valor configurado.

Propriedade hipotecada não cobra aluguel.

Para remover, paga principal mais taxa interna configurada.

Não hipotecar propriedade com melhorias.

Antes da hipoteca, vender melhorias do grupo de forma válida.

Negociação

Uma proposta pode incluir:

créditos fictícios;

propriedades sem melhorias;

cartas negociáveis.

Regras:

somente jogadores ativos;

proposta possui expiração;

recursos ficam disponíveis, mas são revalidados na aceitação;

aceitar executa tudo em uma transação lógica;

qualquer divergência cancela sem efeito parcial;

não negociar durante resolução obrigatória de outra decisão, salvo regra explícita;

servidor nunca confia nos valores calculados pelo cliente.

Cartas

Tipos:

receber ou pagar créditos;

mover para casa;

avançar ou recuar;

receber proteção temporária;

sair de fiscalização;

cobrar ou pagar por quantidade de melhorias;

O baralho usa embaralhamento determinístico baseado em seed segura criada pelo servidor. A seed não é exposta durante a partida.

Fiscalização temporária

Jogador permanece por até três turnos próprios.

Pode usar carta específica.

Pode pagar taxa fictícia.

Pode tentar combinação definida pelos dados, se essa regra estiver habilitada.

Após limite, paga a taxa e sai.

Insolvência e falência

Quando não consegue pagar:

entra em DEBT_RESOLUTION;

pode vender melhorias;

pode hipotecar ativos;

pode negociar se a configuração permitir;

se pagar, continua;

se não conseguir, declara falência.

Na falência:

jogador deixa a ordem de turnos;

ativos passam ao credor ou ao banco conforme a origem da dívida;

estado é persistido;

espectador permanece opcional;

partida verifica condição de vitória.

Timeouts

Decisão de compra expirada: recusar.

Proposta expirada: cancelar.

Turno sem lançamento: servidor lança e resolve automaticamente ou aplica política configurada.

Ação administrativa expirada: encerrar turno.

Desconexão: mesma política, respeitando janela de reconexão.

Tema Baixada Santista

Criar 36 casas distribuídas entre as nove cidades. Nomes, grupos, preços e descrições precisam ser revisáveis no painel. Não usar marcas comerciais ou alegar valores imobiliários reais.

O seed deve validar:

exatamente uma casa inicial;

índices únicos e contínuos;

grupos existentes;

tabelas de aluguel completas;

preços positivos;

referências de cartas válidas;

nível máximo coerente;

assets com fallback.

Informações públicas e privadas

Públicas:

posição;

saldo;

propriedades;

melhorias;

estado de conexão;

turno;

eventos já resolvidos.

Privadas:

cartas secretas;

token de reconexão;

credenciais;

propostas ainda não enviadas;

dados administrativos.

Ranking competitivo

Salas personalizadas, inclusive privadas, são sempre casuais.

Somente partidas formadas pela fila oficial podem alterar rating.

O ranking possui visões diária, semanal, mensal e da temporada.

O cálculo considera força dos adversários, colocação, patrimônio final e
solvência. Falência reduz explicitamente o desempenho.

A fórmula, a versão do cálculo e os ratings antes/depois ficam auditáveis
conforme PHASE_5_ENGINE.md.

