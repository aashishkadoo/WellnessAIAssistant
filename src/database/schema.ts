//src/database/schema.ts
export const DATABASE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );
`;