Segurança

Modelo de ameaça

Considere:

cliente modificado;

repetição de mensagens;

falsificação de identidade;

manipulação de saldo;

comandos fora do turno;

spam de chat;

força bruta;

roubo de sessão;

XSS, CSRF e injeção;

vazamento de dados privados;

negação de serviço;

dependências comprometidas.

Servidor autoritativo

Dados e cartas são gerados no servidor.

Movimento e saldo vêm do estado oficial.

O servidor calcula preço, aluguel, melhoria, dívida e patrimônio.

Identidade é derivada da sessão.

Toda ação verifica room, jogador, fase e turno.

Autenticação

Argon2id com parâmetros calibrados.

Access token de 10 a 15 minutos.

Refresh token opaco e rotativo.

Hash do refresh token no banco.

Cookie HttpOnly, Secure e SameSite.

Revogação por família se token antigo reaparecer.

Mensagens de login não revelam se o e-mail existe.

Rate limit por IP e conta.

Bloqueio progressivo temporário.

Recuperação de senha com token único, curto e armazenado como hash.

HTTP

HTTPS obrigatório.

Helmet.

CORS por allowlist.

CSRF quando autenticação por cookie for aplicável.

Limite de corpo.

Content-Type validado.

Zod/DTO para entrada.

Prisma parametrizado.

Erro de produção sem stack.

WebSocket

WSS.

Verificar Origin.

Autenticação no handshake.

Revalidar autorização na entrada da room.

Limite de tamanho.

Limite de mensagens por segundo.

Timeout de conexão ociosa.

Heartbeat.

Comandos permitidos por fase.

commandId e stateVersion.

Desconectar abuso repetido.

Chat

Texto puro.

Escape na renderização.

Sem HTML, scripts ou URLs transformadas automaticamente.

Limite de tamanho e frequência.

Filtro de conteúdo configurável.

Ferramentas futuras de bloquear, silenciar e denunciar.

Segredos

.env ignorado pelo Git.

.env.example sem valor real.

Segredos via ambiente/secret manager.

Nunca logar senha, token, cookie ou URL assinada.

Rotação documentada.

Dados

Coletar o mínimo.

Definir retenção de logs e chat.

Exportação/exclusão futura de dados pessoais.

Backups criptografados.

Acesso administrativo por menor privilégio.

Audit log para alterações administrativas.

Supply chain

Lockfile versionado.

Dependabot/Renovate.

Auditoria de dependências.

CI com lint, typecheck, testes e build.

Revisar scripts de instalação de novas dependências.

Não carregar assets ou código executável de origem desconhecida em runtime.

Cabeçalhos e CSP

Definir CSP compatível com Babylon e Vite sem liberar unsafe-eval em produção. Restringir:

default-src;

script-src;

connect-src para API/WSS;

img-src;

media-src;

object-src 'none';

frame-ancestors.

Checklist de produção

HTTPS/WSS.

Cookies seguros.

CORS e Origin restritos.

Rate limits.

Dev commands desabilitados.

Painel admin protegido.

Logs sem segredos.

Backup e restauração testados.

Dependências auditadas.

Teste de comandos adulterados.

Teste de reconexão indevida.

Teste de duplicação financeira.