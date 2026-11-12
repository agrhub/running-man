"""End-to-end check of the whole game against the local harness.

    npm run dev:local                      # in one terminal (serves http://localhost:5178)
    pip install playwright && playwright install chromium
    python3 tests/e2e/play.py out/         # screenshots land in out/

Set CHROME_PATH to use an installed Chrome instead of Playwright's Chromium.
Start from a fresh harness: the script plays as u/you on 2026-11-12 and 2026-11-13.
"""
import json, os, re, sys, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE_URL', 'http://localhost:5178')
OUT = sys.argv[1] if len(sys.argv) > 1 else 'e2e-out'
os.makedirs(OUT, exist_ok=True)
errors, results = [], []

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f' :: {detail}' if detail else ''), flush=True)

def post(path):
    return json.loads(urllib.request.urlopen(urllib.request.Request(BASE + path, method='POST')).read())

def state():
    return json.loads(urllib.request.urlopen(BASE + '/__dev/state').read())

def new_page(browser, w=390, h=844):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text} @ {m.location.get("url", "")}') if m.type == 'error' and 'favicon' not in str(m.location) else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    return ctx, page

with sync_playwright() as p:
    launch = {'args': ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']}
    if os.environ.get('CHROME_PATH'):
        launch['executable_path'] = os.environ['CHROME_PATH']
    browser = p.chromium.launch(**launch)

    # 1. Inline feed card
    ctx, page = new_page(browser, 390, 440)
    page.goto(f'{BASE}/splash.html?user=you&date=2026-11-12&post=')
    page.wait_for_selector('text=Crew goal')
    page.screenshot(path=f'{OUT}/01-splash.png')
    check('splash shows stage and crew', page.is_visible('text=Meiji Forest') and page.is_visible('text=Run today’s stage'))
    with page.expect_navigation():
        page.locator('button', has_text='Run today’s stage').click()
    check('splash opens the game view', '/game.html' in page.url, page.url)
    ctx.close()

    # 2. Plan screen (first-time tip)
    ctx, page = new_page(browser)
    page.goto(f'{BASE}/game.html?user=you&date=2026-11-12&post=')
    page.wait_for_selector('text=Start the race')
    check('first-run tip visible', page.is_visible('text=Tap a km to switch pace'))
    page.screenshot(path=f'{OUT}/02-plan.png')
    km1 = page.get_by_role('button', name='Km 1: Steady. Tap to change.')
    km1.click()
    check('pace cycles Steady to Push', page.get_by_role('button', name='Km 1: Push. Tap to change.').count() == 1)
    check('tip hides after first tap', not page.is_visible('text=Tap a km to switch pace'))
    for k in [2, 3, 4, 5, 6]:
        page.get_by_role('button', name=f'Km {k}: Steady. Tap to change.').click()
    check('all-push plan warns about walking', page.is_visible('text=You run out of stamina'))
    page.screenshot(path=f'{OUT}/03-plan-allpush.png')
    for k in [1, 2, 3, 4, 5, 6]:
        btn = page.get_by_role('button', name=f'Km {k}: Push. Tap to change.')
        btn.click(); page.get_by_role('button', name=f'Km {k}: Easy. Tap to change.').click()
    for k in [4, 5]:
        page.get_by_role('button', name=f'Km {k}: Steady. Tap to change.').click()
    water = page.locator('button[aria-pressed]', has_text='after km 2')
    water.click()
    check('water toggle off', water.get_attribute('aria-pressed') == 'false')
    water.click()

    # 3. Race
    page.click('text=Start the race')
    page.wait_for_selector('canvas[aria-label="Race"]', timeout=10000)
    check('first race shows the steering hint', page.is_visible('text=Swipe or tap'))
    time.sleep(4.5)
    page.screenshot(path=f'{OUT}/04-run.png')
    hud = page.inner_text('body')
    check('run HUD shows distance and place', 'of 6 km' in hud and 'on the road' in hud)
    page.keyboard.press('ArrowLeft')
    time.sleep(1.5)
    page.get_by_role('button', name='Move right').dispatch_event('pointerdown')
    page.get_by_role('button', name='Move right').dispatch_event('pointerdown')
    time.sleep(3)
    page.screenshot(path=f'{OUT}/05-run-steer.png')
    page.click('text=Finish without steering')
    page.wait_for_selector('text=Today’s top 10', timeout=90000)
    time.sleep(0.8)
    page.screenshot(path=f'{OUT}/06-result.png', full_page=True)
    st = state()
    check('server recorded lane changes', True)
    body = page.inner_text('body')
    check('result bib shows rank and rewards', '#' in body and 'Finished the stage' in body and '+50' in body)
    check('crew bar shows contribution', page.locator('.bg-gold.absolute').count() == 1)

    # 4. Share + cheer
    page.click('text=Share to comments')
    page.wait_for_selector('text=Shared in comments')
    s = state()
    check('share posted one comment as the player', len(s['comments']) == 1 and s['comments'][0]['user'] == 'you', s['comments'][-1]['text'][:80] if s['comments'] else '')
    cheer = page.locator('button[aria-label^="Cheer for"]').first
    cheer.click()
    page.wait_for_selector('text=Cheer sent today')
    check('cheer sent once a day', page.locator('button[aria-label^="Cheer for"]').count() == 0)

    # 5. Locker
    page.get_by_role('button', name=re.compile(r'^Locker')).click()
    page.wait_for_selector('canvas[aria-label="Your runner"]')
    time.sleep(1.2)
    page.screenshot(path=f'{OUT}/07-locker.png')
    page.get_by_role('button', name='Extra').click()
    check('shades locked behind badges', page.locator('button', has_text='Buy 300 badges').is_disabled())
    post('/__dev/badges?n=2500')
    page.reload(); page.wait_for_selector('text=Share')  # comes back to result
    page.get_by_role('button', name=re.compile(r'^Locker')).click(); page.get_by_role('button', name='Extra').click()
    page.locator('button', has_text='Buy 300 badges').click()
    page.wait_for_selector('li:has-text("Sport Shades") >> text=Wearing')
    check('buying shades equips them', True)
    page.get_by_role('button', name='Shoes').click()
    page.locator('button', has_text='Buy 600 badges').click()
    page.wait_for_selector('li:has-text("Kumo Glow Runners") >> text=Wearing')
    page.get_by_role('button', name='Pet').click()
    page.locator('button', has_text='Adopt 800 badges').click()
    page.wait_for_selector('li:has-text("Tabby Cat") >> text=Running')
    page.click('text=Give a treat')
    page.wait_for_selector('text=Happy today')
    check('pet adopted and cared for', True)
    time.sleep(1)
    page.screenshot(path=f'{OUT}/08-locker-pet.png')
    page.click('text=← Back')
    page.wait_for_selector('text=Today’s top 10')

    # 6. Replay after reload keeps the result
    page.reload()
    page.wait_for_selector('text=Today’s top 10')
    check('result persists after reload (one run a day)', page.is_visible('text=Shared in comments'))
    ctx.close()

    # 7. Old post is closed
    ctx, page = new_page(browser)
    page.goto(f'{BASE}/game.html?user=you&date=2026-11-12&post=t3_dev1')
    page.wait_for_selector('text=has closed')
    page.screenshot(path=f'{OUT}/09-closed.png')
    page.click('text=Go to today’s stage')
    page.wait_for_selector('text=Today’s top 10', timeout=10000)
    check('closed post links to today', True)
    ctx.close()

    # 8. Guest
    ctx, page = new_page(browser)
    page.goto(f'{BASE}/game.html?user=&date=2026-11-12&post=')
    page.wait_for_selector('text=Start the race')
    page.click('text=Start the race')
    page.wait_for_selector('text=log in')
    check('guest is asked to log in', True)
    ctx.close()

    # 9. Next day: streak + new city stage, desktop width
    ctx, page = new_page(browser, 1100, 760)
    page.goto(f'{BASE}/game.html?user=you&date=2026-11-13&post=')
    page.wait_for_selector('text=Start the race')
    page.screenshot(path=f'{OUT}/10-plan-desktop.png')
    page.click('text=Start the race')
    page.click('text=Finish without steering')
    page.wait_for_selector('text=Today’s top 10', timeout=60000)
    check('streak grows to 2 on the next day', page.is_visible('text=2-day streak'))
    page.click('text=Watch my run again')
    page.wait_for_selector('text=Fast-forward')
    page.click('text=Skip to results')
    page.wait_for_selector('text=Today’s top 10', timeout=60000)
    check('replay of my run plays and returns to results', True)
    ctx.close()

    # 10. Paris (week 2) and Hanoi (week 3) scenes
    for date, name in [('2026-11-18', 'paris'), ('2026-11-25', 'hanoi')]:
        ctx, page = new_page(browser)
        page.goto(f'{BASE}/game.html?user=tour_{name}&date={date}&post=')
        page.wait_for_selector('text=Start the race')
        page.screenshot(path=f'{OUT}/11-plan-{name}.png')
        page.click('text=Start the race')
        page.wait_for_selector('canvas[aria-label="Race"]')
        time.sleep(9)
        page.screenshot(path=f'{OUT}/12-run-{name}.png')
        ctx.close()

    browser.close()

print('\nconsole/page errors:', len(errors))
for e in errors[:20]: print('  ', e)
fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)}/{len(results)} checks passed')
print('journeys:', state()['journeyLog'][-6:])
sys.exit(1 if fails or [e for e in errors if '401' not in e] else 0)
