import re, sys
c = open('index.html').read()
missing = [n for p,n in [('/etf/','etf'),('/english/','english'),('/srt/','srt'),('五子棋','gomoku')] if p not in c]
if not missing:
    print('All cards present')
    sys.exit(0)
print('Missing cards:', missing)
BLOCK = '''        <a class="card" href="/etf/">
          <div class="name">ETF 投資工具</div>
          <div class="desc">配息試算、投資組合分析與 ETF 比較</div>
        </a>
        <a class="card" href="/五子棋/">
          <div class="name">五子棋 AI 對戰</div>
          <div class="desc">與 AI 對弈五子棋，四種難度，支援音效與悔棋</div>
        </a>
        <a class="card" href="/english/">
          <div class="name">🎓 AI School 英語學習</div>
          <div class="desc">英語、日語單字練習，雲端記錄，排行榜競賽</div>
        </a>
        <a class="card" href="/srt/">
          <div class="name">🎬 SRT 字幕產生器</div>
          <div class="desc">上傳影片自動生成 SRT 字幕，支援多語言</div>
        </a>'''
new = re.sub(r'<section class="featured-grid">.*?</section>',
    '<section class="featured-grid">\n' + BLOCK + '\n      </section>',
    c, flags=re.DOTALL)
if new != c:
    open('index.html','w').write(new)
    print('Fixed')
    sys.exit(2)
