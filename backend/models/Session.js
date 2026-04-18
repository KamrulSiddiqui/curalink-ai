import mongoose from 'mongoose'

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
})

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  patientName: { type: String, default: '' },
  disease: { type: String, default: '' },
  location: { type: String, default: '' },
  messages: [MessageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

const Session = mongoose.model('Session', SessionSchema)
export default Session