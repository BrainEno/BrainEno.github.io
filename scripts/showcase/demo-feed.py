"""Read-only loopback demo API for capturing the mobile client. No accounts or tokens."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit

stories = [
    ('Notes on Moving Water', 'From the footbridge the water looks still. A single leaf catches on the piling, turns on its stem and slips out of sight.'),
    ('The Quiet Margin', 'In the print shop, the spaces between letters live in a separate drawer. Pick one up and it leaves no mark; take it away and the whole line changes.'),
    ('A Window Facing North', 'The light reaches the opposite wall before it touches the table. By the time the kettle boils, the room has shifted half a shade.'),
]
articles = []
for i, (title, text) in enumerate(stories):
    date = f'2026-11-{20-i}T09:00:00Z'
    articles.append(dict(id=f'10000000-0000-4000-8000-00000000000{i}',
        authorId='10000000-0000-4000-8000-000000000099', slug=title.lower().replace(' ', '-'),
        workType='essay', status='published', locale='en', title=title, summary=text.split('. ')[0]+'.',
        contentBlocks=[dict(id='opening', type='paragraph', text=text)], contentBlocksVersion=0,
        createdAt=date, updatedAt=date, publishedAt=date, viewCount=0, revision='1',
        author=dict(displayName='Paper Studio', userId='10000000-0000-4000-8000-000000000099'),
        categories=[], tags=[]))

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path.removeprefix('/api/v1')
        data = articles if path in ('/articles', '/featured') else []
        for story in articles:
            if path == '/articles/' + story['slug']:
                data = story
            elif path == '/articles/' + story['slug'] + '/related':
                data = [item for item in articles if item != story]
        body = json.dumps({'data': data}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(body)

if __name__ == '__main__':
    HTTPServer(('127.0.0.1', 4000), Handler).serve_forever()
