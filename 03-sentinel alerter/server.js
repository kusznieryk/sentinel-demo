require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const isOriginAllowed = (origin, callback) => {
  // permite requests no-browser (curl, servidores) cuando no hay Origin
  if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
  return callback(new Error('Not allowed by CORS'));
};

const corsOptions = {
  origin: isOriginAllowed,
  methods: ['GET', 'POST', 'OPTIONS'],
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: isOriginAllowed,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.post('/api/v1/webhook/anomaly', (req, res) => {
  const anomalyData = req.body;
  console.log("🚨 Reenviando anomalía al Dashboard:", anomalyData);
  
  io.emit('new_anomaly', {
   ...anomalyData,
    server_timestamp: new Date().toISOString()
  });
  res.status(200).json({ status: "Alert broadcasted" });
});

io.on('connection', (socket) => {
  console.log('💻 Dashboard conectado ID:', socket.id);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Alerter corriendo en puerto ${PORT}`));