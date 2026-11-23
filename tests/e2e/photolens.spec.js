import { test, expect } from '@playwright/test';
import path from 'node:path';

const sample = name => path.resolve('tests/fixtures', name + '.png');
async function dismissOnboarding(page) {
  await page.goto('/');
  const start = page.getByRole('button', { name: 'Bắt đầu' });
  if (await start.isVisible().catch(() => false)) await start.click();
}
async function analyzeOne(page, image) {
  await page.locator('[data-input="A"]').setInputFiles(sample(image));
  await page.getByRole('button', { name: 'Phân tích ảnh' }).click();
  await expect(page.locator('#report .stats-grid')).toBeVisible({ timeout: 15000 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__photolens_test_initialized') !== '1') {
      localStorage.clear();
      sessionStorage.setItem('__photolens_test_initialized', '1');
    }
  });
  await dismissOnboarding(page);
});

test('analyzes one image using local metrics', async ({ page }) => {
  await page.locator('[data-input="A"]').setInputFiles(sample('sharp'));
  await page.getByRole('button', { name: 'Phân tích ảnh' }).click();
  await expect(page.locator('#report .stats-grid')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#report')).toContainText('Báo cáo phân tích');
  await expect(page.locator('#report .metric-tiles')).toContainText('Độ sáng');
});

test('compares two images side by side', async ({ page }) => {
  await page.getByRole('tab', { name: 'So sánh' }).click();
  await page.locator('[data-input="A"]').setInputFiles(sample('sharp'));
  await page.locator('[data-input="B"]').setInputFiles(sample('blur'));
  await page.getByRole('button', { name: 'So sánh ảnh' }).click();
  await page.locator('#report .comparison-details > summary').click();
  await expect(page.locator('#report .metric-table')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#report')).toContainText('So sánh ảnh A và B');
  await expect(page.locator('#report .metric-table tbody tr')).toHaveCount(15);
});

test('exports a JSON report', async ({ page }) => {
  await analyzeOne(page, 'palette');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-export="json"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/PhotoLens-.*.json$/);
});

test('keeps local analysis available when AI is off and opens AI settings from the notice', async ({ page }) => {
  await page.locator('[data-input="A"]').setInputFiles(sample('sharp'));
  await page.locator('#analyzeBtn').click();
  await expect(page.locator('#report .stats-grid')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#report .notice')).toContainText('AI đang tắt');
  await page.locator('#report .configure-ai-button').click();
  await expect(page.locator('#modalHost .modal h2')).toContainText('Cài đặt AI');
  await expect(page.locator('#aiStatusBadge')).toContainText('Chưa cấu hình');
});

test('checks the configured Worker health endpoint', async ({ page }) => {
  await page.route('https://worker.test/health', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, model: 'gemini-test-model' })
  }));
  await page.locator('#settingsBtn').click();
  await page.locator('#proxyInput').fill('https://worker.test');
  await page.locator('#checkAiBtn').click();
  await expect(page.locator('#aiStatusBadge')).toContainText('Sẵn sàng');
  await expect(page.locator('#aiStatusReason')).toContainText('gemini-test-model');
});

test('captures the primary screens at mobile and desktop widths without browser errors', async ({ page }) => {
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  const capture = async (name, width) => {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('.toast.show').waitFor({ state: 'hidden' });
    await page.screenshot({ path: path.resolve('outputs', `PhotoLens-${name}-${width}.png`), fullPage: true });
  };

  await page.addStyleTag({ content: '.bottom-nav { position: static !important; }' });
  await capture('empty', 360);
  await capture('empty', 1280);

  await page.locator('[data-input="A"]').setInputFiles(sample('sharp'));
  await page.locator('#analyzeBtn').click();
  await expect(page.locator('#report .stats-grid')).toBeVisible({ timeout: 15000 });
  await capture('single-report', 360);
  await capture('single-report', 1280);

  await page.getByRole('tab', { name: 'So sánh' }).click();
  await page.locator('[data-input="B"]').setInputFiles(sample('blur'));
  await page.locator('#analyzeBtn').click();
  await expect(page.locator('#report .comparison-overview')).toBeVisible({ timeout: 15000 });
  await capture('compare-report', 360);
  await capture('compare-report', 1280);
  expect(browserErrors).toEqual([]);
});

test('keeps the page within supported responsive widths', async ({ page }) => {
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `unexpected horizontal overflow at ${width}px`).toBe(false);
  }
});

test('switches to the light theme, keeps contrast tokens, and remembers the choice', async ({ page }) => {
  await page.locator('#themeBtn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#themeBtn')).toHaveAttribute('aria-pressed', 'true');
  const unnamedButtons = await page.locator('button:visible').evaluateAll(buttons => buttons
    .filter(button => !(
      button.getAttribute('aria-label') || button.getAttribute('aria-labelledby') ||
      button.getAttribute('title') || button.innerText.trim()
    ))
    .map(button => button.outerHTML.slice(0, 160)));
  expect(unnamedButtons).toEqual([]);

  const colors = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const values = Object.fromEntries([
      'color-bg', 'color-surface', 'color-surface-raised', 'color-text',
      'color-text-secondary', 'color-text-muted', 'color-accent', 'color-accent-ink'
    ].map(name => [name, styles.getPropertyValue(`--${name}`).trim()]));
    const rgb = value => {
      const hex = value.replace('#', '');
      return [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
        .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    };
    const luminance = value => {
      const [red, green, blue] = rgb(value);
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const ratio = (first, second) => {
      const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    };
    values.textRatios = ['color-bg', 'color-surface', 'color-surface-raised'].flatMap(background =>
      ['color-text', 'color-text-secondary', 'color-text-muted'].map(foreground => ({
        foreground, background, ratio: ratio(values[foreground], values[background])
      }))
    );
    values.accentRatio = ratio(values['color-accent-ink'], values['color-accent']);
    return values;
  });
  expect(colors.textRatios.every(pair => pair.ratio >= 4.5)).toBe(true);
  expect(colors.accentRatio).toBeGreaterThanOrEqual(4.5);

  await page.addStyleTag({ content: '.bottom-nav { position: static !important; }' });
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `unexpected horizontal overflow in light theme at ${width}px`).toBe(false);
    await page.screenshot({ path: path.resolve('outputs', `PhotoLens-light-empty-${width}.png`), fullPage: true });
  }

  await analyzeOne(page, 'sharp');
  await page.locator('.toast.show').waitFor({ state: 'hidden' });
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `unexpected horizontal overflow in light report at ${width}px`).toBe(false);
    await page.screenshot({ path: path.resolve('outputs', `PhotoLens-light-single-report-${width}.png`), fullPage: true });
  }

  await page.getByRole('tab', { name: 'So sánh' }).click();
  await page.locator('[data-input="B"]').setInputFiles(sample('blur'));
  await page.locator('#analyzeBtn').click();
  await expect(page.locator('#report .comparison-overview')).toBeVisible({ timeout: 15000 });
  await page.locator('.toast.show').waitFor({ state: 'hidden' });
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `unexpected horizontal overflow in light comparison at ${width}px`).toBe(false);
    await page.screenshot({ path: path.resolve('outputs', `PhotoLens-light-compare-report-${width}.png`), fullPage: true });
  }

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#themeBtn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
