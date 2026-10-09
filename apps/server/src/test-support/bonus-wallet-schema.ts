import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

const MIGRATION_URL = new URL(
	"../db/migrations/0036_bonus_funds_in_main_wallet.sql",
	import.meta.url,
);

/**
 * Applies the real `0036_bonus_funds_in_main_wallet` migration (locked bonus
 * columns, ledgers, the bonus-spend trigger and the game_wallet move) on top
 * of a test schema, so tests exercise exactly what production runs. Creates
 * the tables it touches first when a test did not need them.
 */
export function applyBonusWalletMigration(sqlite: DatabaseSync): void {
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS wallet (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL UNIQUE,
			balance integer NOT NULL DEFAULT 0,
			frozen_balance integer NOT NULL DEFAULT 0,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS wallet_transaction (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			amount integer NOT NULL,
			type text NOT NULL,
			reference text UNIQUE,
			status text NOT NULL,
			payment_method text NOT NULL DEFAULT 'card',
			recipient_wallet_id text,
			recipient_name text,
			balance integer,
			metadata text,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS game_wallet (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL UNIQUE,
			balance integer NOT NULL DEFAULT 0,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS game_wallet_transaction (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			amount integer NOT NULL,
			type text NOT NULL,
			reference text NOT NULL UNIQUE,
			status text NOT NULL,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS bonus_engine_mission_progress (
			user_id text NOT NULL,
			mission_id text NOT NULL,
			progress_percentage real NOT NULL DEFAULT 0,
			completed_at integer,
			reward_json text,
			updated_at integer NOT NULL DEFAULT 0,
			PRIMARY KEY (user_id, mission_id)
		);
		CREATE TABLE IF NOT EXISTS bonus_engine_user_bonus (
			user_id text NOT NULL,
			bonus_id text NOT NULL,
			status text NOT NULL DEFAULT '',
			payload_json text NOT NULL,
			updated_at integer NOT NULL DEFAULT 0,
			PRIMARY KEY (user_id, bonus_id)
		);
		CREATE TABLE IF NOT EXISTS bonus_engine_callback_event (
			id text PRIMARY KEY NOT NULL,
			idempotency_key text NOT NULL UNIQUE,
			event_type text NOT NULL,
			payload_json text NOT NULL,
			processed_at integer NOT NULL DEFAULT 0
		);
	`);

	const migration = readFileSync(MIGRATION_URL, "utf8");
	for (const statement of migration.split("--> statement-breakpoint")) {
		if (statement.trim()) sqlite.exec(statement);
	}
}
