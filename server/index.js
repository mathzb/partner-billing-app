import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import express from "express";

const app = express();
app.use(express.json());

const clampRate = (value) => Math.min(100, Math.max(0, value));

const makeProductKey = (vendorName, productName) =>
  `${vendorName ?? "vendor"}::${productName ?? "product"}`.toLowerCase();

const parseBody = (body = {}) => {
  const tenantId =
    typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  const vendorName =
    typeof body.vendorName === "string" ? body.vendorName.trim() : "";
  const productName =
    typeof body.productName === "string" ? body.productName.trim() : "";
  const rawRate = body.rate;

  return {
    tenantId,
    vendorName,
    productName,
    rate:
      typeof rawRate === "number" && Number.isFinite(rawRate)
        ? Math.round(clampRate(rawRate) * 100) / 100
        : null,
  };
};

const dbFilePath = process.env.DISCOUNT_DB_PATH
  ? path.resolve(process.env.DISCOUNT_DB_PATH)
  : path.resolve(process.cwd(), "data", "discounts.sqlite");

fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

const db = new Database(dbFilePath);
db.exec(`
  CREATE TABLE IF NOT EXISTS tenant_discounts (
    tenant_id TEXT NOT NULL,
    product_key TEXT NOT NULL,
    rate REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, product_key)
  );
`);

const listStmt = db.prepare(
  `SELECT tenant_id, product_key, rate FROM tenant_discounts ORDER BY tenant_id, product_key`,
);
const getStmt = db.prepare(
  `SELECT tenant_id, product_key, rate FROM tenant_discounts WHERE tenant_id = ? AND product_key = ?`,
);
const insertStmt = db.prepare(
  `INSERT INTO tenant_discounts (tenant_id, product_key, rate, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
);
const updateStmt = db.prepare(
  `UPDATE tenant_discounts SET rate = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND product_key = ?`,
);
const upsertStmt = db.prepare(
  `INSERT INTO tenant_discounts (tenant_id, product_key, rate, updated_at)
   VALUES (?, ?, ?, CURRENT_TIMESTAMP)
   ON CONFLICT (tenant_id, product_key)
   DO UPDATE SET rate = excluded.rate, updated_at = CURRENT_TIMESTAMP`,
);
const deleteStmt = db.prepare(
  `DELETE FROM tenant_discounts WHERE tenant_id = ? AND product_key = ?`,
);

const mapRowsToState = (rows) => {
  const discounts = {};
  rows.forEach((row) => {
    if (!discounts[row.tenant_id]) {
      discounts[row.tenant_id] = {};
    }
    discounts[row.tenant_id][row.product_key] = row.rate;
  });
  return discounts;
};

app.get("/api/tenant-discounts", (_request, response) => {
  const rows = listStmt.all();
  response.json({ discounts: mapRowsToState(rows) });
});

app.post("/api/tenant-discounts", (request, response) => {
  const { tenantId, vendorName, productName, rate } = parseBody(request.body);
  if (!tenantId || !vendorName || !productName || rate === null) {
    response.status(400).json({ message: "Ugyldig payload" });
    return;
  }

  const productKey = makeProductKey(vendorName, productName);
  const existing = getStmt.get(tenantId, productKey);
  if (existing) {
    response.status(409).json({ message: "Rabat findes allerede" });
    return;
  }

  insertStmt.run(tenantId, productKey, rate);
  response.status(201).json({ tenantId, productKey, rate });
});

app.patch("/api/tenant-discounts", (request, response) => {
  const { tenantId, vendorName, productName, rate } = parseBody(request.body);
  if (!tenantId || !vendorName || !productName || rate === null) {
    response.status(400).json({ message: "Ugyldig payload" });
    return;
  }

  const productKey = makeProductKey(vendorName, productName);
  const existing = getStmt.get(tenantId, productKey);
  if (!existing) {
    response.status(404).json({ message: "Rabat findes ikke" });
    return;
  }

  updateStmt.run(rate, tenantId, productKey);
  response.json({ tenantId, productKey, rate });
});

app.put("/api/tenant-discounts", (request, response) => {
  const { tenantId, vendorName, productName, rate } = parseBody(request.body);
  if (!tenantId || !vendorName || !productName || rate === null) {
    response.status(400).json({ message: "Ugyldig payload" });
    return;
  }

  const productKey = makeProductKey(vendorName, productName);
  upsertStmt.run(tenantId, productKey, rate);
  response.json({ tenantId, productKey, rate });
});

app.delete("/api/tenant-discounts", (request, response) => {
  const { tenantId, vendorName, productName } = parseBody(request.body);
  if (!tenantId || !vendorName || !productName) {
    response.status(400).json({ message: "Ugyldig payload" });
    return;
  }

  const productKey = makeProductKey(vendorName, productName);
  deleteStmt.run(tenantId, productKey);
  response.status(204).send();
});

const port = Number(process.env.API_PORT ?? 3001);
app.listen(port, () => {
  console.log(`Discount API running on port ${port} (DB: ${dbFilePath})`);
});
