import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import ticketsRoutes from './routes/tickets.js';
 
const app = express();
const PORT = process.env.PORT || 4000;
 
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketsRoutes);

app.listen(PORT, () => {
  console.log(`Auth API (JWT) listening on http://localhost:${PORT}`);
});
 