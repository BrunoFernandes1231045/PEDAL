require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
const { validateProductionRuntimeConfig } = require('./lib/runtimeConfig');
const { signupSecurityConfig } = require('./lib/signupSecurity');
validateProductionRuntimeConfig();
if (process.env.NODE_ENV === 'production') signupSecurityConfig();
const app = require('./app');
const stageReminderJob = require('./lib/stageReminderJob');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`PEDAL API a correr na porta ${PORT}`));
stageReminderJob.start();
