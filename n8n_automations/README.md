# n8n Automation Engine & Vector RAG Pipeline

This directory contains the database SQL workers and JSON workflow definition for **n8n**, operating as an independent background automation service alongside the **FastAPI** web application.

---

## 1. Dual-Writer Architecture & Concurrency Rules

- **FastAPI**: Manages live, synchronous HTTP traffic (seat search, holds, bookings). Writes to Supabase PostgreSQL using `SELECT ... FOR UPDATE` row locks.
- **n8n**: Executes scheduled jobs (every 1 minute or hourly). Reads and updates PostgreSQL using `SELECT ... FOR UPDATE SKIP LOCKED`.
- **Concurrency Isolation**: By using `SKIP LOCKED`, n8n automatically skips rows currently locked by active FastAPI transactions without causing deadlocks or thread blocking.

---

## 2. Included Automation Files

1. `waitlist_promotion.sql`:
   - Runs every 1 minute.
   - Identifies flights with `available_seats > 0` and promotes `WAITING` passengers in `created_at ASC` order.
   - Atomically updates inventory and issues confirmed booking records.

2. `checkin_reminders.sql`:
   - Runs hourly.
   - Queries confirmed bookings for flights departing in 23-25 hours.
   - Triggers Gmail node to dispatch 24h flight check-in notifications.

3. `price_drop_alerts.sql`:
   - Runs daily.
   - Detects fare rule price changes and notifies waitlisted passengers.

4. `pinecone_rag_workflow.json`:
   - Complete n8n workflow importable via n8n UI.
   - Integrates Pinecone Vector DB (index `flight-fare-policies`) with live Supabase PostgreSQL `fare_rules` table.
   - Uses OpenAI / LLM node to draft accurate, policy-compliant customer service emails via Gmail API.

---

## 3. n8n Credentials Setup

In your n8n Instance:
1. **PostgreSQL Credential**: Set host to your Supabase PostgreSQL pooler address (`aws-0-us-east-1.pooler.supabase.com`), port `6543`, database `postgres`.
2. **Pinecone API Credential**: Provide `PINECONE_API_KEY` and index name `flight-fare-policies`.
3. **Gmail OAuth2 Credential**: Provide `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and grant `https://mail.google.com/` scope.
