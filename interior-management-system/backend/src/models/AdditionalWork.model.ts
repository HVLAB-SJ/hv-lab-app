import mongoose from 'mongoose';

const additionalWorkSchema = new mongoose.Schema({
  project: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  notes: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

export default mongoose.model('AdditionalWork', additionalWorkSchema);
