Desenvolvimento e deploy

Ambientes

development: hot reload, ferramentas locais e dados fictícios.

test: banco descartável e execução automatizada.

staging: configuração semelhante à produção.

production: TLS, secrets, backups e observabilidade.

Docker Compose local

Serviços:

game-client
game-server
admin-web
mysql
redis
nginx
adminer (somente profile development)

Redis pode ficar desativado no MVP de uma instância, mas a configuração deve estar preparada.

Variáveis

Exemplo de categorias:

NODE_ENV
APP_ORIGIN
API_ORIGIN
WS_ORIGIN
DATABASE_URL
REDIS_URL
ACCESS_TOKEN_SECRET
REFRESH_TOKEN_PEPPER
COOKIE_DOMAIN
ROOM_CODE_PEPPER
LOG_LEVEL
SENTRY_DSN opcional
ADMIN_BOOTSTRAP_EMAIL
ADMIN_BOOTSTRAP_PASSWORD

O .env.example descreve valores, mas não contém segredos reais.

Proxy

Nginx/Caddy deverá:

terminar TLS;

redirecionar HTTP para HTTPS;

servir assets comprimidos;

encaminhar /api;

encaminhar upgrade WebSocket;

definir timeouts apropriados;

restringir health/metrics quando necessário;

adicionar cabeçalhos de segurança.

Build

Pipeline:

instalação congelada pelo lockfile;

validação de conteúdo;

geração Prisma;

typecheck;

lint;

testes unitários;

testes de integração;

builds;

scan de dependências;

criação de imagens;

deploy em staging;

smoke test;

promoção manual para produção.

Banco

Migrations executadas como job único.

Nunca rodar mudança destrutiva automaticamente sem estratégia.

Backward compatibility durante rolling deploy.

Backup antes de migration sensível.

Procedimento de rollback documentado.

Mobile

Cliente web gera dist/, sincronizado com Capacitor.

pnpm build
npx cap sync
npx cap run android
npx cap run ios

Preparar:

package ID próprio;

ícones e splash;

assinatura Android;

certificados iOS;

universal/app links;

política de privacidade;

tratamento de safe area;

retomada do app;

versões de API compatíveis.

PWA

Manifest.

Ícones.

Service worker.

Cache de assets versionados.

Não cachear respostas autenticadas sensíveis.

Informar atualização disponível.

Tela offline clara; partida online exige conexão.

Assets

CDN ou origem versionada.

Cache longo para nomes com hash.

GLB/GLTF comprimido.

Texturas WebP/AVIF e KTX2 quando aplicável.

Orçamento inicial abaixo de 10 MB antes de entrar na partida.

Carregamento do tema sob demanda.

Observabilidade

Logs JSON.

requestId, connectionId, roomId e gameId.

/health para processo.

/ready para dependências.

Métricas: CCU, rooms, partidas, latência de comando, erros, reconexões e memória.

Alertas por taxa de erro, banco indisponível e loop travado.

Backup

Backup automático MySQL.

Retenção definida.

Cópia fora da máquina principal.

Restauração testada periodicamente.

Snapshots do jogo não substituem backup do banco.

