#!/usr/bin/env python3
"""Samler Index/Styles/JavaScript til docs/index.html (GitHub Pages).
Kør `python3 build.py` efter hver ændring i de tre filer."""
import re
r = lambda f: open(f, encoding='utf-8').read()
html = r('Index.html')
html = html.replace('<base target="_top">\n', '')
html = html.replace('<meta charset="utf-8">',
  '<meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">\n'
  '  <title>Køleskabet</title>\n  <link rel="manifest" href="manifest.webmanifest">\n  <link rel="icon" href="ikon.svg">', 1)
html = html.replace("<?!= include('Styles'); ?>", r('Styles.html'))
html = html.replace("<?!= include('JavaScript'); ?>",
  '<script src="config.js"></script>\n  ' + r('JavaScript.html'))
open('docs/index.html', 'w', encoding='utf-8').write(html)
print('docs/index.html skrevet')
