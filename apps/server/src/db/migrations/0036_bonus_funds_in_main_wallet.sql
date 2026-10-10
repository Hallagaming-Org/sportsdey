-- Bonus Engine bonus funds move from the unused `game_wallet` into the main
-- wallet as a locked, non-withdrawable portion (`wallet.bonus_balance`).
-- Every casino provider and the sportsbook already spend `wallet.balance`, so
-- bonus funds become playable without touching provider code. Invariant:
-- 0 <= bonus_balance <= balance, kept by the trigger below on every debit.
ALTER TABLE `wallet` ADD COLUMN `bonus_balance` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- The most recent debit and how much of it came out of bonus funds (kobo,
-- exact). Read right after a stake to split it into real / bonus, and to lock
-- winnings pro rata when a result cannot be linked to its stake.
ALTER TABLE `wallet` ADD COLUMN `last_debit_kobo` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `wallet` ADD COLUMN `last_debit_bonus_kobo` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bonus_wallet_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`bonus_balance_after` integer,
	`metadata` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `bonus_wallet_ledger_reference_unique` ON `bonus_wallet_ledger` (`reference`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bonus_wallet_ledger_user_idx` ON `bonus_wallet_ledger` (`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bonus_stake_split` (
	`user_id` text NOT NULL,
	`bet_ref` text NOT NULL,
	`stake_kobo` integer NOT NULL,
	`bonus_kobo` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `bet_ref`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bonus_stake_split_created_idx` ON `bonus_stake_split` (`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bonus_engine_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_attempt_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `bonus_engine_outbox_dedupe_unique` ON `bonus_engine_outbox` (`dedupe_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bonus_engine_outbox_due_idx` ON `bonus_engine_outbox` (`status`, `next_attempt_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bonus_engine_loyalty_redemption` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`loyalty_id` text,
	`points` integer NOT NULL,
	`reward_type` text NOT NULL,
	`reward_kobo` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bonus_engine_loyalty_redemption_user_idx` ON `bonus_engine_loyalty_redemption` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bonus_engine_loyalty_redemption_status_idx` ON `bonus_engine_loyalty_redemption` (`status`);
--> statement-breakpoint
-- When `/mission/progress` first reported the mission complete. `completed_at`
-- stays reserved for "reward handled", set only by the complete callback or
-- reconciliation, so the UI never shows a credited reward that is not.
ALTER TABLE `bonus_engine_mission_progress` ADD COLUMN `engine_completed_at` integer;
--> statement-breakpoint
-- Move existing game_wallet bonus funds into the main wallet as locked bonus.
-- Ledger rows first so wallet-vs-ledger reconciliation stays balanced.
INSERT INTO `wallet_transaction` (`id`, `user_id`, `amount`, `type`, `reference`, `status`, `payment_method`, `balance`, `metadata`, `created_at`)
SELECT lower(hex(randomblob(16))), gw.`user_id`, gw.`balance`, 'credit', 'be_bonus_migrate:' || gw.`user_id`, 'success', 'bonus_engine_bonus', w.`balance` + gw.`balance`, '{"source":"game_wallet_migration"}', cast(unixepoch('subsecond') * 1000 as integer)
FROM `game_wallet` gw
JOIN `wallet` w ON w.`user_id` = gw.`user_id`
WHERE gw.`balance` > 0;
--> statement-breakpoint
INSERT INTO `bonus_wallet_ledger` (`id`, `user_id`, `amount`, `kind`, `reference`, `bonus_balance_after`, `metadata`)
SELECT lower(hex(randomblob(16))), gw.`user_id`, gw.`balance`, 'grant', 'be_bonus_migrate:' || gw.`user_id`, w.`bonus_balance` + gw.`balance`, '{"source":"game_wallet_migration"}'
FROM `game_wallet` gw
JOIN `wallet` w ON w.`user_id` = gw.`user_id`
WHERE gw.`balance` > 0;
--> statement-breakpoint
UPDATE `wallet`
SET
	`balance` = `balance` + (SELECT gw.`balance` FROM `game_wallet` gw WHERE gw.`user_id` = `wallet`.`user_id`),
	`bonus_balance` = `bonus_balance` + (SELECT gw.`balance` FROM `game_wallet` gw WHERE gw.`user_id` = `wallet`.`user_id`)
WHERE `user_id` IN (SELECT `user_id` FROM `game_wallet` WHERE `balance` > 0);
--> statement-breakpoint
UPDATE `game_wallet` SET `balance` = 0
WHERE `balance` > 0 AND `user_id` IN (SELECT `user_id` FROM `wallet`);
--> statement-breakpoint
-- Keep legacy game_wallet references so an engine retry of an already
-- credited activation/status change cannot credit it a second time.
INSERT OR IGNORE INTO `bonus_wallet_ledger` (`id`, `user_id`, `amount`, `kind`, `reference`, `metadata`)
SELECT lower(hex(randomblob(16))), `user_id`, 0, 'legacy', `reference`, '{"source":"game_wallet_transaction"}'
FROM `game_wallet_transaction`;
--> statement-breakpoint
-- Real cash is spent first: bonus funds only shrink once a debit takes the
-- balance below them. Records the bonus share of the debit for win locking.
CREATE TRIGGER IF NOT EXISTS `wallet_bonus_balance_spend`
AFTER UPDATE OF `balance` ON `wallet`
WHEN NEW.`balance` < OLD.`balance`
BEGIN
	INSERT INTO `bonus_wallet_ledger` (`id`, `user_id`, `amount`, `kind`, `reference`, `bonus_balance_after`)
	SELECT lower(hex(randomblob(16))), NEW.`user_id`, MAX(NEW.`balance`, 0) - NEW.`bonus_balance`, 'spend', 'spend:' || lower(hex(randomblob(16))), MAX(NEW.`balance`, 0)
	WHERE NEW.`bonus_balance` > MAX(NEW.`balance`, 0);
	UPDATE `wallet`
	SET
		`last_debit_kobo` = OLD.`balance` - NEW.`balance`,
		`last_debit_bonus_kobo` = MAX(NEW.`bonus_balance` - MAX(NEW.`balance`, 0), 0),
		`bonus_balance` = MIN(NEW.`bonus_balance`, MAX(NEW.`balance`, 0))
	WHERE `id` = NEW.`id`;
END;
