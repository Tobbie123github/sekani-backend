
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Used for allowing cross-origin requests


require('dotenv').config();
// Import route handlers
const authRoutes = require('./routes/auth');
const imageRoutes = require('./routes/images');

const app = express();

// Middleware
app.use(express.json()); 
app.use(cors());
app.use(express.urlencoded({ extended: true}));

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true, // allow frontend to send cookies
  })
);

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully!');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1); // Exit process with failure
  }
};
connectDB();



// API Routes
app.get('/', (req, res) => res.send('API Running'));
app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);

// Server Listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));