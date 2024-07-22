import * as postgres from 'pg';

export async function handler(_event: any) {

  const client = new postgres.Client ({
    user: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!),
    database: 'postgres',
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connection sucesful, creating database...');
    await client.query('CREATE DATABASE opennotificaties');
    console.log('Done!');
  } catch (error) {
    console.error(error);
  }

}