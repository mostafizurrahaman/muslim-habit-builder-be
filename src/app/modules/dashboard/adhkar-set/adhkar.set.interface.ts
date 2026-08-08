import { Types } from 'mongoose';


export type IAdhkarItem = {
  title: string;              // "Seek Forgiveness"
  arabic: string;             // Arabic text
  transliteration: string;    // Roman transliteration
  translation: string;        // English meaning
  virtue?: string;            // Hadith virtue text
  reference?: string;         // "Sahih Muslim"
  count: number | null;       // null = no counting needed; 100 = count 100 times
  order: number;              // display order within set
};

export interface IAdhkarSet {
  _id: Types.ObjectId;

  name: string;

  nameArabic?: string;

  totalCount: number;

  items: IAdhkarItem[];

  createdAt: Date;

  updatedAt: Date;
}