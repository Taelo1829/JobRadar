// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const watches = sqliteTable('watches', { id: text('id').primaryKey(), company: text('company').notNull(), role: text('role').notNull(), trackingSince: integer('tracking_since').notNull().default(0), lastMatchAt: integer('last_match_at'), staleAt: integer('stale_at'), board: text('board').notNull().default(''), lastCheck: integer('last_check'), message: text('message').notNull().default('Waiting for first check') });
export const jobs = sqliteTable('jobs', { id: text('id').primaryKey(), watchId: text('watch_id').notNull(), company: text('company').notNull(), title: text('title').notNull(), location: text('location').notNull(), url: text('url').notNull(), description: text('description').notNull(), foundAt: integer('found_at').notNull(), postedAt: integer('posted_at'), status: text('status').notNull().default('new'), appliedAt: integer('applied_at') });
export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull() });
export const subscriptions = sqliteTable('subscriptions', { endpoint: text('endpoint').primaryKey(), createdAt: integer('created_at').notNull() });
export const sourceChecks=sqliteTable('source_checks',{id:text('id').primaryKey(),watchId:text('watch_id').notNull(),source:text('source').notNull(),status:text('status').notNull(),message:text('message').notNull(),checkedAt:integer('checked_at').notNull()});
