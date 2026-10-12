import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const sessionTable = sqliteTable("session", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: integer("expire", { mode: "timestamp" }).notNull(),
});
