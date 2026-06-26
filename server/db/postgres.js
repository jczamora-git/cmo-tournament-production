const { Pool } = require("pg");

function toPostgresSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

async function runQuery(client, sql, params = []) {
  let text = toPostgresSql(sql);
  if (text.trim().toUpperCase().startsWith("INSERT") && !text.toUpperCase().includes("RETURNING")) {
    text += " RETURNING id";
  }
  const result = await client.query(text, params);
  const meta = {
    affectedRows: result.rowCount || 0,
  };

  if (result.rows[0] && Object.prototype.hasOwnProperty.call(result.rows[0], "id")) {
    meta.insertId = result.rows[0].id;
  }

  return [result.rows, meta];
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  client: "postgres",
  query(sql, params) {
    return runQuery(pool, sql, params);
  },
  async getConnection() {
    const client = await pool.connect();
    return {
      client: "postgres",
      query(sql, params) {
        return runQuery(client, sql, params);
      },
      beginTransaction() {
        return client.query("BEGIN");
      },
      commit() {
        return client.query("COMMIT");
      },
      rollback() {
        return client.query("ROLLBACK");
      },
      release() {
        client.release();
      },
    };
  },
  async ping() {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
  },
  end() {
    return pool.end();
  },
};
