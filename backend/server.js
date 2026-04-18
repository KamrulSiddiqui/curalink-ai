import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import connectDB from './config/db.js'
import chatRoutes from './routes/chat.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

connectDB()

// ✅ CORS fix — OPTIONS preflight handle karo
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // OPTIONS add kiya
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// ✅ Preflight requests ke liye explicitly handle karo
app.options('*', cors())  // ← Yeh line add karo

app.use(express.json())

app.use('/api/chat', chatRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'Curalink backend is running!', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`\n🚀 Curalink backend running on http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/api/health\n`)
})