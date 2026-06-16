require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
const app = require('./app');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`PEDAL API a correr na porta ${PORT}`));
