import { Document, Model, Query } from 'mongoose';

// Extend Mongoose types to be more flexible for our use case
declare module 'mongoose' {
  interface Model<T, TQueryHelpers = {}, TMethodsAndOverrides = {}, TVirtuals = {}, TSchema = any> {
    findById(id: any, projection?: any, options?: any): Query<any, T>;
    findByIdAndUpdate(id: any, update?: any, options?: any): Query<any, T>;
    findByIdAndDelete(id: any, options?: any): Query<any, T>;
    find(filter?: any, projection?: any, options?: any): Query<any[], T>;
    findOne(filter?: any, projection?: any, options?: any): Query<any, T>;
    findOneAndUpdate(filter?: any, update?: any, options?: any): Query<any, T>;
    findOneAndDelete(filter?: any, options?: any): Query<any, T>;
    create(docs: any, options?: any): Promise<any>;
    updateOne(filter?: any, update?: any, options?: any): Query<any, T>;
    updateMany(filter?: any, update?: any, options?: any): Query<any, T>;
    deleteOne(filter?: any, options?: any): Query<any, T>;
    deleteMany(filter?: any, options?: any): Query<any, T>;
    countDocuments(filter?: any, options?: any): Query<number, T>;
  }
}
