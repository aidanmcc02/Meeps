const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";

let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction
      ? {
          rejectUnauthorized: false
        }
      : false
  });
} else {
  pool = new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || "meeps",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres"
  });
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};

