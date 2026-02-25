import mysql from "mysql2/promise";

// Lazy pool initialization to ensure env vars are loaded
let _crmPool: mysql.Pool | null = null;
let _automationPool: mysql.Pool | null = null;

function getCrmPool(): mysql.Pool {
  if (!_crmPool) {
    _crmPool = mysql.createPool({
      host: process.env.CRM_MYSQL_HOST,
      user: process.env.CRM_MYSQL_USER,
      password: process.env.CRM_MYSQL_PASSWORD,
      database: "afformation_system",
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 15000,
    });
  }
  return _crmPool;
}

function getAutomationPool(): mysql.Pool {
  if (!_automationPool) {
    _automationPool = mysql.createPool({
      host: process.env.CRM_MYSQL_HOST,
      user: process.env.CRM_MYSQL_USER,
      password: process.env.CRM_MYSQL_PASSWORD,
      database: "automation",
      waitForConnections: true,
      connectionLimit: 3,
      connectTimeout: 15000,
    });
  }
  return _automationPool;
}

// Export as getters so pool is created lazily
export const crmPool = new Proxy({} as mysql.Pool, {
  get(_target, prop) {
    return (getCrmPool() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const automationPool = new Proxy({} as mysql.Pool, {
  get(_target, prop) {
    return (getAutomationPool() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/** Test MySQL connection and return version info */
export async function testConnection(): Promise<{
  connected: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const pool = getCrmPool();
    const conn = await pool.getConnection();
    const [rows] = await conn.query("SELECT VERSION() as version");
    conn.release();
    const version = (rows as Array<{ version: string }>)[0]?.version;
    return { connected: true, version };
  } catch (err) {
    return { connected: false, error: (err as Error).message };
  }
}
