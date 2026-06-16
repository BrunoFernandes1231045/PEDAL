const express = require('express');
const cors = require('cors');
const candidatesRouter = require('./routes/candidates');
const messagesRouter = require('./routes/messages');
const onboardingRouter = require('./routes/onboarding');
const trainersRouter = require('./routes/trainers');
const stationsRouter = require('./routes/stations');
const needsRouter = require('./routes/needs');
const contactRequestsRouter = require('./routes/contactRequests');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/candidates', candidatesRouter);
app.use('/api/candidates/:id/messages', messagesRouter);
app.use('/api/candidates/:id/onboarding', onboardingRouter);
app.use('/api/trainers', trainersRouter);
app.use('/api/stations', stationsRouter);
app.use('/api/needs', needsRouter);
app.use('/api/contact-requests', contactRequestsRouter);

module.exports = app;
