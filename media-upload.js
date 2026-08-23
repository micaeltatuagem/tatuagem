/* ===========================================================
   media-upload.js — upload de mídia (imagem OU vídeo) compartilhado
   por todos os painéis admin do site, via Supabase Storage.

   Por quê: antes, cada painel (Flash, Galeria, Aerografia, Corpos)
   tinha sua PRÓPRIA função de upload, commitando o arquivo direto
   no repositório do GitHub como base64. Isso funcionava só pra
   imagem pequena, inflava o histórico do Git pra sempre, e não
   suportava vídeo de jeito nenhum. Este arquivo centraliza o
   upload num único lugar (bucket "site-media" no Supabase), pra
   todos os painéis usarem a mesma lógica testada, com suporte
   a vídeo desde o início.

   Requer que a página já tenha carregado antes deste script:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="/media-upload.js"></script>
   =========================================================== */
(function (global) {
  const MEDIA_SUPABASE_URL = 'https://rpgcsejfewltricfsdrd.supabase.co';
  const MEDIA_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZ2NzZWpmZXdsdHJpY2ZzZHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTU0MzAsImV4cCI6MjA5NzQ3MTQzMH0.BHg2X0MVIokfnBjTK0DPt1NDB1H9sjXeUVZ1lJ3jKo0';
  const MEDIA_BUCKET = 'site-media';

  const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v'];
  // Bucket "site-media" está no plano gratuito do Supabase, com teto de 50MB
  // por arquivo — mantemos uma margem de segurança abaixo disso.
  const MAX_VIDEO_MB = 45;
  const MAX_IMAGE_MB = 15;

  let _client = null;
  function getClient() {
    if (_client) return _client;
    if (typeof supabase === 'undefined') {
      throw new Error('Biblioteca do Supabase não carregou. Confira se o <script> do supabase-js vem ANTES do media-upload.js.');
    }
    _client = supabase.createClient(MEDIA_SUPABASE_URL, MEDIA_SUPABASE_ANON);
    return _client;
  }

  function fileExt(file) {
    return (file.name.split('.').pop() || '').toLowerCase();
  }

  function isVideoFile(file) {
    if (file.type && file.type.startsWith('video/')) return true;
    return VIDEO_EXTENSIONS.includes(fileExt(file));
  }

  function isVideoUrl(url) {
    if (!url) return false;
    const clean = url.split('?')[0].split('#')[0];
    const ext = clean.split('.').pop().toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  }

  // Gera uma imagem de capa (poster) a partir do primeiro segundo de um
  // vídeo, capturando um frame num <canvas> escondido. Usada como preview
  // de compartilhamento (WhatsApp/Facebook) e como thumbnail na galeria
  // antes do visitante clicar em play.
  function captureVideoPoster(file) {
    return new Promise((resolve, reject) => {
      const videoEl = document.createElement('video');
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.preload = 'auto';
      videoEl.src = URL.createObjectURL(file);

      const cleanup = () => URL.revokeObjectURL(videoEl.src);

      videoEl.addEventListener('loadeddata', () => {
        // pula pra ~10% do vídeo (ou 0.3s) — evita pegar frame preto do início
        const seekTo = Math.min(videoEl.duration * 0.1 || 0.3, 1.5);
        videoEl.currentTime = seekTo;
      });
      videoEl.addEventListener('seeked', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = videoEl.videoWidth || 640;
          canvas.height = videoEl.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            cleanup();
            if (!blob) { reject(new Error('Falha ao gerar thumbnail do vídeo.')); return; }
            const posterFile = new File([blob], 'poster.jpg', { type: 'image/jpeg' });
            resolve(posterFile);
          }, 'image/jpeg', 0.85);
        } catch (err) {
          cleanup();
          reject(err);
        }
      });
      videoEl.addEventListener('error', () => {
        cleanup();
        reject(new Error('Não foi possível ler o vídeo pra gerar a capa.'));
      });
    });
  }

  // Upload cru pro Storage. Retorna a URL pública final.
  async function rawUpload(file, folder) {
    const sb = getClient();
    const ext = fileExt(file) || 'bin';
    const cleanExt = ext.replace(/[^a-z0-9]/g, '') || 'bin';
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${cleanExt}`;
    const { error } = await sb.storage.from(MEDIA_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || undefined
    });
    if (error) throw new Error(error.message || 'Falha no upload para o Supabase Storage.');
    const { data } = sb.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Envia um arquivo (imagem ou vídeo) pro bucket compartilhado.
   *
   * @param {File} file - arquivo escolhido pelo usuário
   * @param {string} folder - pasta dentro do bucket, ex: "flash", "galeria/feminino", "aerografia", "corpos"
   * @returns {Promise<{url: string, isVideo: boolean, posterUrl: string|null}>}
   *   - url: URL pública do arquivo enviado (imagem ou vídeo)
   *   - isVideo: true se for vídeo
   *   - posterUrl: URL pública da capa gerada automaticamente (só quando isVideo, senão null)
   */
  async function uploadMedia(file, folder) {
    const video = isVideoFile(file);
    const maxMB = video ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > maxMB * 1024 * 1024) {
      const atualMB = (file.size / 1024 / 1024).toFixed(1);
      throw new Error(`Arquivo muito grande (${atualMB}MB). Limite: ${maxMB}MB para ${video ? 'vídeo' : 'imagem'}.`);
    }

    let posterUrl = null;
    if (video) {
      try {
        const posterFile = await captureVideoPoster(file);
        posterUrl = await rawUpload(posterFile, folder + '/capas');
      } catch (err) {
        // não trava o upload do vídeo por causa da capa — só avisa no console
        console.warn('Não foi possível gerar capa automática do vídeo:', err.message);
      }
    }

    const url = await rawUpload(file, folder);
    return { url, isVideo: video, posterUrl };
  }

  // Resolve uma URL de mídia armazenada: se já for absoluta (Supabase, essa
  // migração), usa como está; se for um caminho relativo antigo (antes da
  // migração pra Supabase, tipo "flash/foo.webp"), gruda o domínio do site
  // na frente, exatamente como o código antigo fazia.
  function resolveUrl(pathOrUrl, siteUrl) {
    if (!pathOrUrl) return pathOrUrl;
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return `${siteUrl}/${pathOrUrl}`;
  }

  // Apaga um arquivo do bucket a partir da URL pública dele (usado quando o
  // admin exclui um item da galeria, pra não deixar arquivo órfão ocupando
  // espaço do plano gratuito do Supabase). Best-effort: nunca lança erro,
  // só avisa no console se não conseguir.
  async function deleteMedia(url) {
    if (!url || !/^https?:\/\//i.test(url)) return; // não é URL do Supabase (ex: caminho antigo do GitHub) — nada a fazer aqui
    const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return; // não é desse bucket — não mexe
    const path = decodeURIComponent(url.slice(idx + marker.length));
    try {
      const sb = getClient();
      const { error } = await sb.storage.from(MEDIA_BUCKET).remove([path]);
      if (error) console.warn('Não foi possível apagar do Storage:', path, error.message);
    } catch (err) {
      console.warn('Não foi possível apagar do Storage:', path, err.message);
    }
  }

  global.MediaUpload = { uploadMedia, isVideoFile, isVideoUrl, resolveUrl, deleteMedia };
})(window);
