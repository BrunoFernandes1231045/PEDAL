const express = require('express');
const cors = require('cors');
const candidatesRouter = require('./routes/candidates');
const messagesRouter = require('./routes/messages');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/candidates', candidatesRouter);
app.use('/api/candidates/:id/messages', messagesRouter);

module.exports = app;
