const express = require('express');
const cors = require('cors');
const dayjs = require('dayjs');
const db = require('./database');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

app.use('/api/costumes', require('./routes/costumes'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/troupes', require('./routes/troupes'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/cycle-rules', require('./routes/cycleRules'));
app.use('/api/outbound', require('./routes/outbound'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
