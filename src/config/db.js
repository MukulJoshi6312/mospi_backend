import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

pool.on('connect', () => console.log('Postgres connected'));
pool.on('error', (err) => console.error('Postgres error', err));

// Always call as query(text, [params]) — never interpolate user input.
export const query = (text, params) => pool.query(text, params);
