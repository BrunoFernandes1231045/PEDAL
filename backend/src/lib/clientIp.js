const net = require('net');

function normaliseIp(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  const withoutMappedPrefix = candidate.startsWith('::ffff:')
    ? candidate.slice('::ffff:'.length)
    : candidate;
  return net.isIP(withoutMappedPrefix) ? withoutMappedPrefix : null;
}

function clientIp(req) {
  // Express calcula req.ip usando apenas a quantidade/CIDR de proxies marcada
  // como confiável em app.js. Não confiamos diretamente em cabeçalhos que um
  // cliente também consegue enviar.
  return normaliseIp(req.ip)
    || normaliseIp(req.socket && req.socket.remoteAddress)
    || 'unknown';
}

module.exports = { clientIp, normaliseIp };
