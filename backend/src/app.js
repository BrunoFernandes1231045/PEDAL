const express = require('express');
const cors = require('cors');
const candidatesRouter = require('./routes/candidates');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/candidates', candidatesRouter);

module.exports = app;
