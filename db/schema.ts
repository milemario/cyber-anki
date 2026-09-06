import { integer, text, sqliteTable, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const students = sqliteTable('students', {
  neptun: text('neptun').primaryKey(), createdAt: integer('created_at').notNull(), lastSeen: integer('last_seen').notNull(),
});
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(), neptun: text('neptun').notNull().references(() => students.neptun), expiresAt: integer('expires_at').notNull(),
}, table => [index('idx_sessions_expiry').on(table.expiresAt)]);
export const progress = sqliteTable('progress', {
  neptun: text('neptun').notNull().references(() => students.neptun), cardId: text('card_id').notNull(),
  dueAt: integer('due_at').notNull(), intervalDays: integer('interval_days').notNull(), reviews: integer('reviews').notNull(),
  againCount: integer('again_count').notNull(), streak: integer('streak').notNull(), lastRating: text('last_rating').notNull(), updatedAt: integer('updated_at').notNull(),
}, table => [primaryKey({ columns: [table.neptun, table.cardId] })]);
export const reviews = sqliteTable('reviews', {
  eventId: text('event_id').primaryKey(), neptun: text('neptun').notNull().references(() => students.neptun),
  cardId: text('card_id').notNull(), rating: text('rating').notNull(), createdAt: integer('created_at').notNull(), applied: integer('applied').notNull().default(0),
}, table => [index('idx_reviews_student_time').on(table.neptun, table.createdAt)]);
