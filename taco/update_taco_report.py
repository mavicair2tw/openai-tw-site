#!/usr/bin/env python3
import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

from urllib.request import Request, urlopen

SOURCE = 'https://www.trumpstruth.org/stats'
DEFAULT_END = date.today() - timedelta(days=1)
WINDOW_DAYS = 365


def fetch_html(start_date: date, end_date: date) -> str:
    url = f'{SOURCE}?start_date={start_date.isoformat()}&end_date={end_date.isoformat()}'
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(req, timeout=30) as resp:
        return resp.read().decode('utf-8')


def grab(pattern: str, html: str):
    m = re.search(pattern, html, re.S)
    return int(m.group(1).replace(',', '')) if m else None


def aggregate(rows, key_fn):
    out = defaultdict(lambda: {'originals': 0, 'quotes': 0, 'reblogs': 0, 'total': 0})
    for row in rows:
        bucket = key_fn(row)
        for k in ('originals', 'quotes', 'reblogs', 'total'):
            out[bucket][k] += row[k]
    return [{'label': k, **out[k]} for k in sorted(out.keys())]


def build_data(html: str):
    m = re.search(r'window\.statsChartData = (\{.*?\});\s*window\.statsHourChartData = (\{.*?\});', html, re.S)
    if not m:
        raise RuntimeError('Could not locate chart data in source HTML')

    chart = json.loads(m.group(1))
    hours = json.loads(m.group(2))

    labels = chart['labels']
    orig = chart['datasets'][0]['data']
    quotes = chart['datasets'][1]['data']
    reblogs = chart['datasets'][2]['data']

    rows = []
    for d, o, q, r in zip(labels, orig, quotes, reblogs):
        dt = datetime.strptime(d, '%Y-%m-%d').date()
        rows.append({
            'date': d,
            'originals': o,
            'quotes': q,
            'reblogs': r,
            'total': o + q + r,
            'week': dt.isocalendar().week,
            'year': dt.isocalendar().year,
            'month': dt.strftime('%Y-%m'),
            'quarter': f"{dt.year}-Q{((dt.month - 1) // 3) + 1}",
        })

    all_time = {
        'totalPosts': grab(r'stats-page__summary-value stats-page__summary-value--total">([\d,]+)</span>', html),
        'originals': grab(r'stats-page__summary-card--original[\s\S]*?<span class="stats-page__summary-value">([\d,]+)</span>', html),
        'quotes': grab(r'stats-page__summary-card--quote[\s\S]*?<span class="stats-page__summary-value">([\d,]+)</span>', html),
        'reblogs': grab(r'stats-page__summary-card--reblog[\s\S]*?<span class="stats-page__summary-value">([\d,]+)</span>', html),
        'avgPostsPerDay': grab(r'Average posts per day:</strong>\s*([\d,]+)', html),
        'peakDayCount': grab(r'Peak day:</strong>\s*[^<]+\(([\d,]+) posts\)', html),
    }

    totals = [r['total'] for r in rows]
    peak = max(rows, key=lambda r: r['total']) if rows else None

    data = {
        'generatedAt': datetime.now().isoformat(timespec='seconds'),
        'source': SOURCE,
        'coverage': {'start': labels[0], 'end': labels[-1]},
        'allTime': all_time,
        'selectedWindow': {
            'days': len(rows),
            'totalPosts': sum(totals),
            'avgPerDay': round(sum(totals) / len(totals), 2) if totals else 0,
            'maxDailyPosts': peak['total'] if peak else 0,
            'maxDailyDate': peak['date'] if peak else None,
        },
        'hourly': hours,
        'views': {
            'daily': rows[-30:],
            'weekly': aggregate(rows[-84:], lambda r: f"{r['year']}-W{r['week']:02d}"),
            'monthly': aggregate(rows, lambda r: r['month']),
            'quarterly': aggregate(rows, lambda r: r['quarter']),
            'yearly': aggregate(rows, lambda r: r['date'][:4]),
        },
    }
    return data


def main():
    end_date = DEFAULT_END
    if len(sys.argv) > 1:
        end_date = datetime.strptime(sys.argv[1], '%Y-%m-%d').date()
    start_date = end_date - timedelta(days=WINDOW_DAYS - 1)
    html = fetch_html(start_date, end_date)
    data = build_data(html)
    out = Path(__file__).with_name('data.json')
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f'Wrote {out}')


if __name__ == '__main__':
    main()
