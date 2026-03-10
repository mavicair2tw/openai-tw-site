CREATE TABLE IF NOT EXISTS taco_events (
    id SERIAL PRIMARY KEY,
    event_timestamp TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL,
    quote TEXT NOT NULL,
    paraphrase TEXT,
    topic TEXT,
    tone TEXT,
    market_score INTEGER DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    report_date TIMESTAMPTZ DEFAULT NOW(),
    summary TEXT NOT NULL,
    highlights JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
