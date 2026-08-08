import { Types } from 'mongoose';


export type TQuranContentImages ={
  pages: Express.Multer.File[]; 
}
export interface IQuranContent {
  
  _id: Types.ObjectId;
  name: string;
  nameArabic?: string;
  totalVerses: number;
  pages: number;
  images: {
    order: number;
    imageUrl: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
  
}