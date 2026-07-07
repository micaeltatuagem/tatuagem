/**
 * Worker "gh-proxy" — proxy autenticado entre o painel admin e a API do GitHub.
 *
 * Por que isso existe:
 *   Hoje o adminflash.html guarda o token do GitHub direto no navegador (em
 *   memória/localStorage) e chama api.github.com com ele. Qualquer pessoa com
 *   acesso ao DevTools do navegador consegue ver esse token.
 *
 *   Esse Worker resolve isso: o token real (GITHUB_TOKEN) fica só aqui, como
 *   "secret" do Cloudflare — nunca trafega até o navegador. O admin.html passa
 *   a usar uma SENHA simples (ADMIN_PASSWORD) só pra provar que é você. O
 *   Worker confere a senha e, se estiver certa, refaz a chamada pra API do
 *   GitHub usando o token real.
 *
 * Como o admin.html deve chamar isso:
 *   Troque toda URL   https://api.github.com/...
 *   por                https://SEU-WORKER.workers.dev/gh/...
 *   (mesmo caminho depois de /gh/, mesmo método, mesmo body)
 *
 *   E troque o header  Authorization: token ${GH_TOKEN}
 *   por                Authorization: Bearer ${ADMIN_PASSWORD}
 */

const REPO_OWNER = "micaeltatuagem";
const REPO_NAME  = "tatuagem";

export default {
  async fetch(request, env) {
    // Só aceita chamadas por /gh/...
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/gh/")) {
      return new Response("Not found", { status: 404 });
    }

    // 1) Confere a senha enviada pelo painel admin
    const auth = request.headers.get("Authorization") || "";
    const senhaEnviada = auth.replace(/^Bearer\s+/i, "");
    if (senhaEnviada !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ message: "Senha inválida" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) Trava de segurança: só deixa mexer no repo esperado, nunca em outro
    const githubPath = url.pathname.replace(/^\/gh/, ""); // ex: /repos/owner/repo/contents/...
    const permitido = githubPath.startsWith(`/repos/${REPO_OWNER}/${REPO_NAME}`);
    if (!permitido) {
      return new Response(JSON.stringify({ message: "Caminho não permitido" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3) Repassa a chamada pra API real do GitHub, agora com o token de verdade
    const githubUrl = "https://api.github.com" + githubPath + url.search;

    const init = {
      method: request.method,
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        "User-Agent": "tatuagem-admin-worker",
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.text();
    }

    const ghResponse = await fetch(githubUrl, init);

    // 4) Devolve a resposta do GitHub direto pro painel admin
    return new Response(ghResponse.body, {
      status: ghResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};
