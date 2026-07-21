const express = require('express');
const router = express.Router();

// GET /api/auth-config — público (sem auth). Expõe feature flags de autenticação
// controladas por variáveis de ambiente do backend, já que o frontend não tem
// nenhum mecanismo de build (Vite/webpack) para injetar env vars.
router.get('/', (req, res) => {
  res.json({
    passwordRecoveryEmailEnabled: process.env.PASSWORD_RECOVERY_EMAIL_ENABLED === 'true',
  });
});

module.exports = router;
