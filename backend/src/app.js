const express = require('express');
const cors = require('cors');
const path = require('path');
const candidatesRouter = require('./routes/candidates');
const messagesRouter = require('./routes/messages');
const onboardingRouter = require('./routes/onboarding');
const trainersRouter = require('./routes/trainers');
const stationsRouter = require('./routes/stations');
const needsRouter = require('./routes/needs');
const contactRequestsRouter = require('./routes/contactRequests');
const notificationsRouter = require('./routes/notifications');
const dashboardRouter = require('./routes/dashboard');
const coordUsersRouter = require('./routes/coordUsers');
const localitiesRouter = require('./routes/localities');
const settingsRouter = require('./routes/settings');
const authConfigRouter = require('./routes/authConfig');
const documentsRouter = require('./routes/documents');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', '..')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
// URLs "limpas" (sem .html) para as páginas de recuperação de palavra-passe,
// para corresponderem exatamente ao redirectTo configurado no Supabase.
app.get('/recuperar-palavra-passe', (req, res) => res.sendFile(path.join(__dirname, '..', '..', 'recuperar-palavra-passe.html')));
app.get('/nova-palavra-passe', (req, res) => res.sendFile(path.join(__dirname, '..', '..', 'nova-palavra-passe.html')));
app.use('/api/auth-config', authConfigRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/candidates/:id/messages', messagesRouter);
app.use('/api/candidates/:id/onboarding', onboardingRouter);
app.use('/api/trainers', trainersRouter);
app.use('/api/stations', stationsRouter);
app.use('/api/needs', needsRouter);
app.use('/api/contact-requests', contactRequestsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/coord-users', coordUsersRouter);
app.use('/api/localities', localitiesRouter);
app.use('/api/settings', settingsRouter);

module.exports = app;
