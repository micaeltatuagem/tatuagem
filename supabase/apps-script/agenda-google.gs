/**
 * Ponte entre o site (Edge Functions do Supabase) e o seu Google Agenda.
 * Roda COMO VOCÊ — não precisa de chave de conta de serviço.
 *
 * Instalação: veja supabase/README-agenda.md (seção "1. Google").
 * Requisitos: serviço avançado "Google Calendar API" adicionado ao projeto
 *             e a propriedade de script SEGREDO definida.
 */
function doPost(e) {
  try {
    var segredo = PropertiesService.getScriptProperties().getProperty('SEGREDO');
    var req = JSON.parse(e.postData.contents);
    if (!segredo || req.segredo !== segredo) return saida({ erro: 'nao_autorizado' });

    if (req.op === 'freebusy') {
      var r = Calendar.Freebusy.query({
        timeMin: req.timeMin,
        timeMax: req.timeMax,
        timeZone: 'America/Sao_Paulo',
        items: req.ids.map(function (id) { return { id: id }; })
      });
      return saida({ calendars: r.calendars });
    }

    if (req.op === 'criar') {
      try {
        var ev = Calendar.Events.insert({
          id: req.id,
          summary: req.titulo,
          description: req.descricao,
          start: { dateTime: req.inicioISO, timeZone: 'America/Sao_Paulo' },
          end: { dateTime: req.fimISO, timeZone: 'America/Sao_Paulo' },
          transparency: 'opaque',
          reminders: { useDefault: true }
        }, req.calId);
        return saida({ id: ev.id });
      } catch (err) {
        if (/already exists|identifier/i.test(String(err))) return saida({ id: req.id }); // já criado antes
        throw err;
      }
    }
    if (req.op === 'avisar') {
      // Envia SEMPRE para o dono do script (nunca para um endereço vindo do pedido)
      var dono = Session.getEffectiveUser().getEmail();
      MailApp.sendEmail(dono, String(req.assunto).slice(0, 200), String(req.corpo).slice(0, 5000));
      return saida({ ok: true });
    }
    return saida({ erro: 'op_invalida' });
  } catch (err) {
    return saida({ erro: String(err) });
  }
}

function saida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
