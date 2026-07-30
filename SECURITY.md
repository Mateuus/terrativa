# Política de Segurança

## Versões suportadas

A Terrativa está em fase inicial de desenvolvimento. Somente a versão mais recente da branch `main` recebe correções de segurança.

| Versão | Suporte |
| --- | --- |
| `main` | ✅ |
| builds, forks e commits antigos | ❌ |

## Relatando uma vulnerabilidade

Não abra issue, discussão ou Pull Request público com detalhes exploráveis.

Use preferencialmente o recurso **Report a vulnerability** na aba Security do repositório:

<https://github.com/Mateuus/terrativa/security/advisories/new>

Se o recurso não estiver disponível, envie o relato para `mateuus27@outlook.com` com o assunto `[SECURITY] Terrativa`.

Inclua, quando possível:

- componente e versão ou commit afetado;
- impacto esperado;
- passos mínimos para reprodução;
- prova de conceito sem dados de terceiros;
- mitigação ou correção sugerida;
- forma segura de contato.

## Processo esperado

- confirmação inicial do recebimento em até 7 dias;
- avaliação de severidade e escopo;
- coordenação privada da correção;
- publicação do aviso após a correção ou mitigação;
- crédito ao pesquisador, caso desejado e permitido.

O prazo de correção depende da severidade e da complexidade. Pedimos divulgação coordenada e tempo razoável antes de qualquer publicação.

## Escopo prioritário

- autenticação, sessões e recuperação de conta;
- execução de scripts ou upload de assets no Studio;
- autorização administrativa;
- manipulação de saldo, turnos ou estado autoritativo;
- salas, WebSocket e reconexão;
- injeção, XSS, CSRF, SSRF e travessia de diretórios;
- exposição de segredos ou dados pessoais;
- dependências ou pipelines comprometidos.

Não execute testes destrutivos, negação de serviço, engenharia social ou acesso a dados de outras pessoas.

O modelo de ameaças técnico está em [Docs/SECURITY.md](./Docs/SECURITY.md).

