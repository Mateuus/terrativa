import { type BoardContent, boardContentSchema } from "./schema.js";

const BOARD_ID = "9b835496-1969-49f4-8aef-1d11da39c6ab";

const cities = [
  city(
    "santos",
    "Santos",
    "#176B87",
    "Canais, jardins, morros e memória portuária inspiram o início da rota regional.",
  ),
  city(
    "sao-vicente",
    "São Vicente",
    "#2E8B57",
    "A rota destaca paisagens insulares, travessias e referências da história vicentina.",
  ),
  city(
    "praia-grande",
    "Praia Grande",
    "#F2B84B",
    "Orla extensa, ciclovias e espaços de convivência marcam este trecho do tabuleiro.",
  ),
  city(
    "guaruja",
    "Guarujá",
    "#2F80A0",
    "Praias, fortalezas e áreas de Mata Atlântica formam um distrito entre mar e morros.",
  ),
  city(
    "cubatao",
    "Cubatão",
    "#477A51",
    "Serra do Mar, rios e transformação ambiental orientam decisões de desenvolvimento.",
  ),
  city(
    "bertioga",
    "Bertioga",
    "#4AAE9B",
    "Fortificações, canais, restingas e praias preservadas inspiram este trecho da jornada.",
  ),
  city(
    "mongagua",
    "Mongaguá",
    "#E19A3B",
    "Cachoeiras, pesca amadora e espaços ecológicos aproximam natureza e comunidade.",
  ),
  city(
    "itanhaem",
    "Itanhaém",
    "#B36C52",
    "Costões, caminhos e patrimônio histórico compõem um distrito dedicado à memória.",
  ),
  city(
    "peruibe",
    "Peruíbe",
    "#665A9E",
    "Mata Atlântica, rios, manguezais e sítios históricos encerram a rota regional.",
  ),
];

const groups = [
  group(1, "santos", "Circuito de Santos", "#176B87", 70, "CITY"),
  group(2, "sao-vicente", "Circuito de São Vicente", "#2E8B57", 60, "CITY"),
  group(3, "praia-grande", "Circuito de Praia Grande", "#F2B84B", 80, "CITY"),
  group(4, "guaruja", "Circuito de Guarujá", "#2F80A0", 90, "CITY"),
  group(5, "cubatao", "Circuito de Cubatão", "#477A51", 75, "CITY"),
  group(6, "bertioga", "Circuito de Bertioga", "#4AAE9B", 100, "CITY"),
  group(7, "mongagua", "Circuito de Mongaguá", "#E19A3B", 85, "CITY"),
  group(8, "itanhaem", "Circuito de Itanhaém", "#B36C52", 110, "CITY"),
  group(9, "peruibe", "Circuito de Peruíbe", "#665A9E", 120, "CITY"),
  group(10, "mobilidade-regional", "Mobilidade Regional", "#64748B", 100, "MOBILITY"),
  group(11, "conservacao-costeira", "Conservação Costeira", "#3F8C73", 90, "CONSERVATION"),
];

const tiles = [
  neutralTile(
    0,
    "START",
    "Portal da Baixada",
    "santos",
    "A jornada começa em um portal fictício que conecta as nove cidades do mapa.",
    "A Baixada Santista reúne municípios ligados por deslocamentos, paisagens e histórias compartilhadas.",
  ),
  propertyTile(
    1,
    "PROPERTY",
    "Canais de Santos",
    "santos",
    "santos",
    140,
    "Um distrito fictício inspirado nos canais que estruturam parte da paisagem urbana santista.",
    "Os canais são referências marcantes na organização e na identidade visual de Santos.",
  ),
  neutralTile(
    2,
    "REGIONAL_EVENT",
    "Maré Regional",
    "santos",
    "Uma mudança regional altera os planos e revela uma carta de evento.",
    "Cidades costeiras planejam mobilidade e atividades considerando chuva, marés e temporada.",
  ),
  propertyTile(
    3,
    "PROPERTY",
    "Monte Serrat",
    "santos",
    "santos",
    160,
    "Um núcleo fictício de visitação inspirado nas vistas e caminhos do Monte Serrat.",
    "Do Monte Serrat é possível observar diferentes partes de Santos e municípios vizinhos.",
  ),
  propertyTile(
    4,
    "PROPERTY",
    "Ponte Pênsil",
    "sao-vicente",
    "sao-vicente",
    120,
    "Um empreendimento fictício de convivência inspirado em um símbolo da paisagem vicentina.",
    "A Ponte Pênsil integra a memória urbana e os roteiros de São Vicente.",
  ),
  neutralTile(
    5,
    "COMMUNITY_BENEFIT",
    "Praça Comunitária",
    "sao-vicente",
    "Uma iniciativa coletiva oferece uma carta de benefício comunitário.",
    "Praças e espaços públicos favorecem lazer, encontros e atividades culturais.",
  ),
  propertyTile(
    6,
    "PROPERTY",
    "Ilha Porchat",
    "sao-vicente",
    "sao-vicente",
    140,
    "Um mirante fictício inspirado na paisagem elevada entre as praias vicentinas.",
    "A Ilha Porchat oferece pontos de observação das praias de São Vicente e Santos.",
  ),
  propertyTile(
    7,
    "TRANSPORT",
    "Travessia Vicentina",
    "sao-vicente",
    "mobilidade-regional",
    200,
    "Uma conexão aquaviária fictícia que aproxima trechos da rota regional.",
    "Travessias e pontes ajudam a integrar áreas insulares e continentais da região.",
  ),
  propertyTile(
    8,
    "PROPERTY",
    "Fortaleza de Itaipu",
    "praia-grande",
    "praia-grande",
    180,
    "Um circuito fictício de visitação inspirado na fortaleza e na Mata Atlântica do entorno.",
    "A Fortaleza de Itaipu ocupa uma área com vista para a Baía de Santos.",
  ),
  propertyTile(
    9,
    "PROPERTY",
    "Portinho",
    "praia-grande",
    "praia-grande",
    200,
    "Um espaço fictício de lazer junto às águas, pensado para convivência e planejamento.",
    "O Portinho está entre os espaços de lazer e turismo divulgados pelo município.",
    {
      imageUrl: "/assets/places/portinho-praia-grande.jpg",
      alt: "Vista do Portinho, em Praia Grande, junto à área verde e às águas.",
      credit: "Jacinto Alves de Souza, via Wikimedia Commons",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Praia_Grande-_Portinho-SP_-Brasil_-_panoramio.jpg",
      license: "CC BY-SA 3.0",
    },
  ),
  feeTile(
    10,
    "Manutenção da Orla",
    "praia-grande",
    100,
    "A conservação preventiva da rota exige uma contribuição fictícia.",
    "Calçadões, ciclovias e equipamentos públicos precisam de manutenção contínua.",
  ),
  neutralTile(
    11,
    "COMMUNITY_BENEFIT",
    "Circuito de Ciclovias",
    "praia-grande",
    "Uma ação de mobilidade ativa oferece um benefício à comunidade.",
    "Praia Grande possui uma ciclovia que acompanha grande parte de sua orla.",
  ),
  propertyTile(
    12,
    "PROPERTY",
    "Forte dos Andradas",
    "guaruja",
    "guaruja",
    220,
    "Um polo fictício de educação histórica e ambiental inspirado no Forte dos Andradas.",
    "O forte está inserido em uma ampla área preservada de Mata Atlântica.",
  ),
  propertyTile(
    13,
    "PROPERTY",
    "Pitangueiras",
    "guaruja",
    "guaruja",
    240,
    "Um distrito fictício de convivência inspirado em uma praia central do Guarujá.",
    "Pitangueiras reúne atividades esportivas, culturais e de lazer em sua orla.",
  ),
  neutralTile(
    14,
    "REGIONAL_EVENT",
    "Mudança de Maré",
    "guaruja",
    "Uma condição costeira inesperada revela um evento regional.",
    "Planejamento costeiro considera condições do mar, acesso e preservação ambiental.",
  ),
  propertyTile(
    15,
    "TRANSPORT",
    "Travessia do Estuário",
    "guaruja",
    "mobilidade-regional",
    200,
    "Uma rota aquaviária fictícia conecta as duas margens do estuário.",
    "A mobilidade regional combina vias terrestres e diferentes travessias aquaviárias.",
  ),
  propertyTile(
    16,
    "PROPERTY",
    "Serra do Mar",
    "cubatao",
    "cubatao",
    160,
    "Um centro fictício de visitação responsável inspirado nas paisagens da Serra do Mar.",
    "A Serra do Mar reúne Mata Atlântica, caminhos históricos e nascentes importantes.",
  ),
  neutralTile(
    17,
    "INSPECTION",
    "Fiscalização Regional",
    "cubatao",
    "Uma verificação temporária pausa o deslocamento para revisar as regras do território.",
    "Fiscalização e planejamento ajudam a compatibilizar uso urbano e proteção ambiental.",
  ),
  propertyTile(
    18,
    "PROPERTY",
    "Parque Anilinas",
    "cubatao",
    "cubatao",
    180,
    "Um polo fictício de cultura, lazer e encontro inspirado no parque urbano.",
    "O Parque Anilinas é um espaço central de convivência e atividades culturais em Cubatão.",
  ),
  propertyTile(
    19,
    "UTILITY",
    "Centro de Gestão Ambiental",
    "cubatao",
    "conservacao-costeira",
    170,
    "Um serviço fictício coordena recuperação, monitoramento e educação ambiental.",
    "A transformação ambiental de Cubatão tornou planejamento e monitoramento temas regionais relevantes.",
  ),
  propertyTile(
    20,
    "PROPERTY",
    "Forte São João",
    "bertioga",
    "bertioga",
    260,
    "Um circuito cultural fictício inspirado na fortificação junto ao canal.",
    "O Forte São João é uma referência histórica divulgada pelo turismo de Bertioga.",
  ),
  neutralTile(
    21,
    "REGIONAL_EVENT",
    "Encontro das Águas",
    "bertioga",
    "O encontro entre canal, rio e mar produz uma nova condição de jogo.",
    "Ambientes costeiros conectam águas, restingas, manguezais e comunidades.",
  ),
  propertyTile(
    22,
    "PROPERTY",
    "Restinga de Itaguaré",
    "bertioga",
    "bertioga",
    280,
    "Um núcleo fictício de visitação de baixo impacto inspirado na restinga preservada.",
    "Itaguaré integra uma área de restinga protegida e possui características naturais preservadas.",
  ),
  propertyTile(
    23,
    "TRANSPORT",
    "Travessia do Canal",
    "bertioga",
    "mobilidade-regional",
    200,
    "Uma travessia fictícia completa o conjunto de mobilidade do tabuleiro.",
    "Canais costeiros são caminhos de circulação e também ecossistemas que exigem cuidado.",
  ),
  propertyTile(
    24,
    "PROPERTY",
    "Poço das Antas",
    "mongagua",
    "mongagua",
    200,
    "Um circuito fictício de natureza inspirado em trilhas, cachoeiras e piscinas naturais.",
    "O Poço das Antas é um parque turístico conhecido por quedas-d'água e contato com a natureza.",
  ),
  propertyTile(
    25,
    "PROPERTY",
    "Plataforma de Pesca",
    "mongagua",
    "mongagua",
    220,
    "Um espaço fictício de convivência inspirado na plataforma de pesca amadora.",
    "A plataforma é um dos pontos turísticos mais conhecidos de Mongaguá.",
  ),
  neutralTile(
    26,
    "COMMUNITY_BENEFIT",
    "Parque Ecológico",
    "mongagua",
    "Uma atividade educativa em grupo gera um benefício comunitário.",
    "Parques ecológicos aproximam visitantes de temas como fauna, flora e conservação.",
  ),
  neutralTile(
    27,
    "REST",
    "Pausa na Orla",
    "mongagua",
    "Uma parada sem efeito financeiro permite reorganizar a estratégia.",
    "Áreas de descanso e convivência tornam a experiência urbana mais acolhedora.",
  ),
  propertyTile(
    28,
    "PROPERTY",
    "Cama de Anchieta",
    "itanhaem",
    "itanhaem",
    300,
    "Um percurso fictício de contemplação inspirado na passarela e no costão rochoso.",
    "A passarela da Cama de Anchieta atravessa uma paisagem costeira ligada à memória local.",
  ),
  propertyTile(
    29,
    "PROPERTY",
    "Convento da Conceição",
    "itanhaem",
    "itanhaem",
    320,
    "Um núcleo fictício de preservação inspirado no conjunto histórico de Itanhaém.",
    "O Convento Nossa Senhora da Conceição integra o patrimônio histórico do litoral paulista.",
  ),
  feeTile(
    30,
    "Conservação Histórica",
    "itanhaem",
    120,
    "A preservação do circuito cultural exige uma contribuição fictícia.",
    "Patrimônio histórico depende de pesquisa, conservação, acesso responsável e manutenção.",
  ),
  neutralTile(
    31,
    "REGIONAL_EVENT",
    "Rota Cultural",
    "itanhaem",
    "Uma programação cultural altera a próxima decisão estratégica.",
    "Centros históricos reúnem edificações, praças, museus e caminhos de diferentes períodos.",
  ),
  propertyTile(
    32,
    "PROPERTY",
    "Ruínas do Abarebebê",
    "peruibe",
    "peruibe",
    340,
    "Um espaço fictício de memória inspirado no sítio histórico de Peruíbe.",
    "As Ruínas do Abarebebê são reconhecidas como patrimônio histórico e cultural do município.",
  ),
  propertyTile(
    33,
    "UTILITY",
    "Centro de Conservação Costeira",
    "peruibe",
    "conservacao-costeira",
    170,
    "Um serviço fictício conecta monitoramento de praias, rios, manguezais e florestas.",
    "Peruíbe reúne unidades de conservação, Mata Atlântica, rios e ambientes costeiros.",
  ),
  propertyTile(
    34,
    "PROPERTY",
    "Guaraú e Jureia",
    "peruibe",
    "peruibe",
    360,
    "Um circuito fictício de visitação responsável inspirado em rios, praias e Mata Atlântica.",
    "A região do Guaraú dá acesso a paisagens naturais próximas ao mosaico Jureia-Itatins.",
  ),
  neutralTile(
    35,
    "VISITING",
    "Mirante da Rota",
    "peruibe",
    "Uma casa neutra encerra a volta com uma visão simbólica do território percorrido.",
    "Observar a paisagem como conjunto ajuda a compreender conexões entre cidades e ecossistemas.",
  ),
];

const decks = [
  {
    id: stableId(4, 1),
    type: "REGIONAL_EVENT",
    name: "Eventos Regionais",
    cards: [
      card(
        1,
        "festival-regional",
        "Festival Regional",
        "A programação movimentou a região. Receba 80 créditos.",
        "Eventos culturais podem ativar espaços públicos e aproximar comunidades.",
        { type: "RECEIVE", amount: 80 },
      ),
      card(
        2,
        "frente-fria",
        "Frente Fria",
        "Reorganize sua operação e pague 70 créditos.",
        "Mudanças meteorológicas afetam mobilidade e atividades em cidades costeiras.",
        { type: "PAY", amount: 70 },
      ),
      card(
        3,
        "nova-conexao",
        "Nova Conexão Regional",
        "Avance até o Portal da Baixada e receba o bônus de volta.",
        "Integração regional reduz distâncias e amplia possibilidades de cooperação.",
        { type: "MOVE_TO", position: 0, collectPassStart: true },
      ),
      card(
        4,
        "obra-na-via",
        "Obra na Via",
        "Ajuste sua rota e recue três casas.",
        "Obras programadas exigem sinalização, rotas alternativas e comunicação clara.",
        { type: "MOVE_STEPS", steps: -3 },
      ),
      card(
        5,
        "temporada-movimentada",
        "Temporada Movimentada",
        "Sua preparação funcionou. Receba 120 créditos.",
        "Planejar capacidade e serviços ajuda cidades a lidar com períodos mais movimentados.",
        { type: "RECEIVE", amount: 120 },
      ),
      card(
        6,
        "manutencao-costeira",
        "Manutenção Costeira",
        "Pague 25 créditos por melhoria construída.",
        "Manutenção preventiva reduz riscos e prolonga a vida útil de estruturas.",
        { type: "REPAIRS", amountPerUpgrade: 25 },
      ),
      card(
        7,
        "rota-alternativa",
        "Rota Alternativa",
        "Uma nova conexão permite avançar três casas.",
        "Redes de mobilidade resilientes oferecem mais de um caminho entre destinos.",
        { type: "MOVE_STEPS", steps: 3 },
      ),
      card(
        8,
        "vistoria-preventiva",
        "Vistoria Preventiva",
        "A revisão identificou ajustes. Pague 50 créditos.",
        "Vistorias preventivas ajudam a encontrar problemas antes que cresçam.",
        { type: "PAY", amount: 50 },
      ),
    ],
  },
  {
    id: stableId(4, 2),
    type: "COMMUNITY_BENEFIT",
    name: "Benefícios Comunitários",
    cards: [
      card(
        9,
        "mutirao-comunitario",
        "Mutirão Comunitário",
        "A cooperação reduziu custos. Receba 100 créditos.",
        "Ações coletivas podem melhorar espaços compartilhados e fortalecer vínculos.",
        { type: "RECEIVE", amount: 100 },
      ),
      card(
        10,
        "fundo-comunitario",
        "Fundo Comunitário",
        "Um projeto local foi concluído. Receba 60 créditos.",
        "Recursos bem planejados podem apoiar iniciativas de interesse coletivo.",
        { type: "RECEIVE", amount: 60 },
      ),
      card(
        11,
        "passe-fiscalizacao",
        "Passe de Fiscalização",
        "Guarde esta carta para sair da fiscalização temporária.",
        "Documentação organizada torna verificações mais claras e eficientes.",
        { type: "GET_OUT_OF_INSPECTION" },
        true,
      ),
      card(
        12,
        "oficina-preventiva",
        "Oficina Preventiva",
        "Pague 15 créditos por melhoria para realizar manutenção.",
        "Pequenos cuidados frequentes podem evitar reparos maiores no futuro.",
        { type: "REPAIRS", amountPerUpgrade: 15 },
      ),
      card(
        13,
        "integracao-regional",
        "Integração Regional",
        "Avance até o Forte São João, na casa 20.",
        "Projetos integrados podem conectar cultura, mobilidade e meio ambiente.",
        { type: "MOVE_TO", position: 20, collectPassStart: false },
      ),
      card(
        14,
        "economia-planejada",
        "Economia Planejada",
        "Sua reserva cobriu os imprevistos. Receba 70 créditos.",
        "Uma reserva ajuda a lidar com despesas inesperadas sem abandonar objetivos.",
        { type: "RECEIVE", amount: 70 },
      ),
      card(
        15,
        "acao-educativa",
        "Ação Educativa",
        "O projeto compartilhou conhecimento. Receba 50 créditos.",
        "Informação acessível ajuda mais pessoas a participar das decisões do território.",
        { type: "RECEIVE", amount: 50 },
      ),
      card(
        16,
        "reparo-emergencial",
        "Reparo Emergencial",
        "Uma estrutura precisou de atenção imediata. Pague 40 créditos.",
        "Reservas e planos de contingência ajudam a responder rapidamente a emergências.",
        { type: "PAY", amount: 40 },
      ),
    ],
  },
];

const rawContent = {
  schemaVersion: 1,
  id: BOARD_ID,
  slug: "baixada-santista",
  name: "Baixada Santista",
  edition: "Terrativa: Baixada Santista",
  locale: "pt-BR",
  version: 2,
  tileCount: 36,
  startingBalance: 1_500,
  passStartReward: 200,
  inspectionPosition: 17,
  economyDisclaimer:
    "Todos os preços, aluguéis, taxas e créditos deste pacote são valores fictícios de balanceamento e não representam imóveis, serviços ou custo de vida reais.",
  rules: {
    inspectionFee: 50,
    maxInspectionTurns: 3,
    purchaseDecisionMs: 15_000,
    tradeExpiryMs: 60_000,
    maxRounds: 60,
  },
  sources: [
    {
      label: "Prefeitura de Santos — Conheça Santos",
      url: "https://www.santos.sp.gov.br/?q=hotsite%2Fconheca-santos",
      usage: "Referência institucional para paisagens, centro histórico, orla e mobilidade.",
    },
    {
      label: "Prefeitura de São Vicente — Visite São Vicente",
      url: "https://www.saovicente.sp.gov.br/hotsites/visite-sao-vicente-1",
      usage: "Referência institucional para patrimônio, paisagens e pontos de visitação.",
    },
    {
      label: "Turismo Praia Grande",
      url: "https://turismo.praiagrande.sp.gov.br/",
      usage: "Referência institucional para orla, ciclovias e espaços culturais.",
    },
    {
      label: "Prefeitura de Guarujá — Praias",
      url: "https://www.guaruja.sp.gov.br/sample-page-2/praias",
      usage: "Referência institucional para praias, fortalezas e áreas preservadas.",
    },
    {
      label: "Prefeitura de Cubatão — Turismo",
      url: "https://www.cubatao.sp.gov.br/turismo/",
      usage: "Referência institucional para turismo, Serra do Mar e Parque Anilinas.",
    },
    {
      label: "Prefeitura de Bertioga — Turismo",
      url: "https://www.bertioga.sp.gov.br/turismo/",
      usage: "Referência institucional para forte, canal, restingas e praias.",
    },
    {
      label: "Prefeitura de Mongaguá — Turismo",
      url: "https://mongagua.sp.gov.br/turismo",
      usage: "Referência institucional para parques, plataforma e Poço das Antas.",
    },
    {
      label: "Prefeitura de Itanhaém — Turismo",
      url: "https://www2.itanhaem.sp.gov.br/turismo/",
      usage: "Referência institucional para patrimônio, costões e roteiros históricos.",
    },
    {
      label: "Prefeitura de Peruíbe — Turismo",
      url: "https://www.peruibe.sp.gov.br/turismo/",
      usage: "Referência institucional para patrimônio e ambientes naturais protegidos.",
    },
  ],
  cities,
  groups,
  tiles,
  decks,
};

export const baixadaSantistaContent: BoardContent = Object.freeze(
  boardContentSchema.parse(rawContent),
);

function city(key: string, name: string, accentColor: string, introduction: string) {
  return { key, name, accentColor, introduction };
}

function group(
  index: number,
  key: string,
  name: string,
  color: string,
  upgradeCost: number,
  category: "CITY" | "MOBILITY" | "CONSERVATION",
) {
  return {
    id: stableId(1, index),
    key,
    name,
    color,
    upgradeCost,
    maxLevel: 4,
    category,
  };
}

function neutralTile(
  position: number,
  type: "START" | "REGIONAL_EVENT" | "COMMUNITY_BENEFIT" | "INSPECTION" | "VISITING" | "REST",
  name: string,
  cityKey: string,
  description: string,
  educationalText: string,
) {
  return {
    id: stableId(2, position + 1),
    position,
    type,
    name,
    description,
    educationalText,
    cityKey,
    asset: asset(cityKey, name, type),
    media: null,
    property: null,
    amount: null,
    targetPosition: null,
    collectPassStart: false,
  };
}

function propertyTile(
  position: number,
  type: "PROPERTY" | "TRANSPORT" | "UTILITY",
  name: string,
  cityKey: string,
  groupKey: string,
  purchasePrice: number,
  description: string,
  educationalText: string,
  media: {
    imageUrl: string;
    alt: string;
    credit: string;
    sourceUrl: string;
    license: string;
  } | null = null,
) {
  return {
    id: stableId(2, position + 1),
    position,
    type,
    name,
    description,
    educationalText,
    cityKey,
    asset: asset(cityKey, name, type),
    media,
    property: {
      id: stableId(3, position + 1),
      groupKey,
      purchasePrice,
      mortgageValue: Math.floor(purchasePrice * 0.5),
      unmortgageCost: Math.ceil(purchasePrice * 0.55),
      rentByLevel: rents(purchasePrice),
    },
    amount: null,
    targetPosition: null,
    collectPassStart: false,
  };
}

function feeTile(
  position: number,
  name: string,
  cityKey: string,
  amount: number,
  description: string,
  educationalText: string,
) {
  return {
    ...neutralTile(position, "REST", name, cityKey, description, educationalText),
    type: "MUNICIPAL_FEE",
    amount,
  };
}

function card(
  index: number,
  key: string,
  title: string,
  publicText: string,
  educationalText: string,
  effect:
    | { type: "RECEIVE"; amount: number }
    | { type: "PAY"; amount: number }
    | { type: "MOVE_TO"; position: number; collectPassStart: boolean }
    | { type: "MOVE_STEPS"; steps: number }
    | { type: "GET_OUT_OF_INSPECTION" }
    | { type: "REPAIRS"; amountPerUpgrade: number },
  tradable = false,
) {
  return {
    id: stableId(5, index),
    key,
    title,
    publicText,
    educationalText,
    effect,
    tradable,
    enabled: true,
  };
}

function asset(cityKey: string, name: string, type: string) {
  return {
    key: `boards/baixada-santista/${cityKey}/${slugify(name)}`,
    fallbackKey: `tiles/fallback/${type.toLowerCase()}`,
  };
}

function rents(price: number): number[] {
  return [0.08, 0.25, 0.7, 1.4, 2.3].map((multiplier) =>
    Math.max(5, Math.round((price * multiplier) / 5) * 5),
  );
}

function stableId(namespace: number, index: number): string {
  return `${namespace}0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
