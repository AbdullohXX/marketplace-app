import pg from 'pg';
import { MongoClient } from 'mongodb';
if (!process.env.DATABASE_URL || !process.env.MONGODB_URI) throw new Error('Set DATABASE_URL and MONGODB_URI in .env');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, statement_timeout: 20000 });
export const mongoClient = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
export const mongo = mongoClient.db(process.env.MONGODB_DB || 'marketplace');
export async function connect() { await pool.query('SELECT 1'); await mongoClient.connect(); await mongo.command({ ping: 1 }); }
export async function close() { await Promise.all([pool.end(), mongoClient.close()]); }
