import { Schema, model } from 'mongoose';
import { IQuranContent } from './quran.content.interface';


const quranContentSchema = new Schema<IQuranContent>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameArabic: {
      type: String,
      trim: true,
    },
    totalVerses: {
      type: Number,
      required: true,
      min: 0,
    },
    pages: {
      type: Number,
      required: true,
      min: 0,
    },
    images: [{
      order: {
        type: Number,
        required: true,
      },
      imageUrl: {
        type: String,
        required: true,
      },
      _id: false

    }],
  },

  {
    timestamps: true,
    versionKey: false,
  }
);


quranContentSchema.index({ name: 1 });

export const QuranContent = model<IQuranContent>('QuranContent', quranContentSchema);