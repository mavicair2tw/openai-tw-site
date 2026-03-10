export interface TACOEvent {
  id: number;
  event_timestamp: string;
  source: string;
  quote: string;
  paraphrase?: string;
  topic?: string;
  tone?: string;
  market_score?: number;
}

export interface DailyReport {
  id: number;
  report_date: string;
  summary: string;
  highlights: string[];
}

export interface NarrativePoint {
  topic: string;
  today_weight: number;
  weekly_weight: number;
}

export interface MarketAlert {
  id: number;
  quote: string;
  market_score: number;
}
