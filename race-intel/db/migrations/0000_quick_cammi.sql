CREATE TYPE "public"."candidate_status" AS ENUM('declared', 'considering', 'withdrawn', 'incumbent');--> statement-breakpoint
CREATE TYPE "public"."considering_status" AS ENUM('pending_review', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."office" AS ENUM('senate', 'house', 'governor');--> statement-breakpoint
CREATE TYPE "public"."rater" AS ENUM('cook', 'sabato', 'inside', '270towin');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('R', 'D', 'bipartisan', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('fec', 'manual', 'scrape');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('rss', 'html', 'api');--> statement-breakpoint
CREATE TYPE "public"."vendor_category" AS ENUM('digital', 'mail', 'polling', 'general_consulting', 'comms', 'fundraising', 'tv_production', 'research', 'compliance', 'legal', 'media_buying', 'data', 'field', 'platform_processor');--> statement-breakpoint
CREATE TABLE "candidate_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid,
	"vendor_id" uuid,
	"category" "vendor_category" NOT NULL,
	"total_spent_cycle" numeric(15, 2),
	"first_payment" timestamp,
	"last_payment" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fec_id" varchar(20),
	"full_name" text NOT NULL,
	"party" varchar(10),
	"state" varchar(2) NOT NULL,
	"office" "office" NOT NULL,
	"district" varchar(10),
	"race_id" uuid,
	"status" "candidate_status" DEFAULT 'declared' NOT NULL,
	"photo_url" text,
	"bioguide_id" varchar(20),
	"source" "source" DEFAULT 'fec' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "committees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fec_id" varchar(20) NOT NULL,
	"candidate_id" uuid,
	"committee_type" varchar(10),
	"treasurer_name" text,
	"address" text,
	"phone" varchar(30),
	"email_public" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "considering_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"office" "office" NOT NULL,
	"state" varchar(2) NOT NULL,
	"district" varchar(10),
	"signal_strength" integer NOT NULL,
	"quote" text,
	"source_url" text,
	"source_publication" text,
	"extracted_at" timestamp DEFAULT now(),
	"status" "considering_status" DEFAULT 'pending_review' NOT NULL,
	"reviewer_notes" text,
	"race_id" uuid
);
--> statement-breakpoint
CREATE TABLE "disbursements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid,
	"payee_name" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"date" timestamp,
	"purpose" text,
	"category" "vendor_category",
	"vendor_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid,
	"report_period_end" timestamp,
	"cash_on_hand" numeric(15, 2),
	"total_receipts" numeric(15, 2),
	"total_disbursements" numeric(15, 2),
	"burn_rate" numeric(8, 4),
	"debt" numeric(15, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ingested_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"url" text NOT NULL,
	"title" text,
	"body_text" text,
	"published_at" timestamp,
	"fetched_at" timestamp DEFAULT now(),
	"processed_at" timestamp,
	CONSTRAINT "ingested_articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "known_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"aliases" text[],
	"category" "vendor_category" NOT NULL,
	"side" "side" DEFAULT 'unknown' NOT NULL,
	"is_platform_processor" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "known_vendors_canonical_name_unique" UNIQUE("canonical_name")
);
--> statement-breakpoint
CREATE TABLE "race_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"race_id" uuid,
	"rater" "rater" NOT NULL,
	"rating" varchar(50) NOT NULL,
	"captured_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "races" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle" integer NOT NULL,
	"office" "office" NOT NULL,
	"state" varchar(2) NOT NULL,
	"district" varchar(10),
	"seat_class" varchar(5),
	"incumbent_candidate_id" uuid,
	"is_open_seat" boolean DEFAULT false,
	"primary_date" timestamp,
	"general_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "source_type" NOT NULL,
	"url" text NOT NULL,
	"last_polled" timestamp,
	"polling_cadence_hours" integer DEFAULT 24,
	"category" varchar(30),
	"state" varchar(2),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staff_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid,
	"person_name" text NOT NULL,
	"role" text,
	"source_url" text,
	"extracted_at" timestamp DEFAULT now(),
	"status" varchar(20) DEFAULT 'pending'
);
--> statement-breakpoint
ALTER TABLE "candidate_vendors" ADD CONSTRAINT "candidate_vendors_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_vendors" ADD CONSTRAINT "candidate_vendors_vendor_id_known_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."known_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "considering_candidates" ADD CONSTRAINT "considering_candidates_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financials" ADD CONSTRAINT "financials_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingested_articles" ADD CONSTRAINT "ingested_articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_ratings" ADD CONSTRAINT "race_ratings_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_mentions" ADD CONSTRAINT "staff_mentions_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;