const express = require('express');
const { coordinatorMfaRequired } = require('../middleware/auth');
const router = express.Router();

// GET /api/auth-config — público (sem auth). Expõe feature flags de autenticação
// controladas por variáveis de ambiente do backend, já que o frontend não tem
// nenhum mecanismo de build (Vite/webpack) para injetar env vars.
router.get('/', (req, res) => {
  res.json({
    passwordRecoveryEmailEnabled: process.env.PASSWORD_RECOVERY_EMAIL_ENABLED === 'true',
    // Lida no login para saber se há que pedir TOTP. A decisão de acesso
    // continua a ser tomada no backend (middleware/auth.js) — isto só evita
    // pedir um código que nenhuma rota vai exigir.
    coordinatorMfaEnabled: coordinatorMfaRequired(),
  });
});

module.exports = router;
