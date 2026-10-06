/* eslint-disable no-undef -- Browser globals used in page.evaluate */
// Base Playwright fixtures deliberately avoid joining a Foundry world.
const { test, expect } = require('@playwright/test')
const { compareChatButtonScope } = require('./chat-button-scope')

const specimens = [
  { name: 'enhanced-probe', domId: 'target', selector: 'button' },
  { name: 'generic-chat', domId: 'controls', selector: 'button, a.button' }
]

async function snapshot (page) {
  return page.evaluate(() => ({
    rules: [...document.styleSheets].map(sheet => [...sheet.cssRules].map(rule => rule.cssText)),
    inline: [...document.querySelectorAll('button, a.button')].map(el => ({
      cssText: el.style.cssText,
      declarations: [...el.style].map(p => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]),
      transition: getComputedStyle(el).transitionDuration
    }))
  }))
}

for (const broad of [true, false]) {
  for (const running of [false, true]) {
    test(`scope comparator ${broad ? 'detects broad' : 'accepts scoped'} paint with ${running ? 'running' : 'enabled'} core transitions`, async ({ page }) => {
      // All requests are fulfilled locally; no Foundry server or GM session.
      await page.route('http://scope-probe.test/**', route => {
        if (route.request().url().endsWith('/systems/dcc/probe.css')) {
          return route.fulfill({
            contentType: 'text/css',
            body: `
            ${broad ? 'button, a.button' : '#target button'} {
              --button-text-color: #d0beaa !important;
              --button-background-color: #333;
              --button-border-color: #777;
              --button-hover-text-color: #eee;
              --button-hover-background-color: #444;
              --button-hover-border-color: #888;
            }
          `
          })
        }
        return route.fulfill({
          contentType: 'text/html',
          body: `
          <style>
            button, a.button {
              --button-text-color: #111;
              --button-background-color: #eee;
              --button-border-color: #222;
              color: var(--button-text-color);
              background-color: var(--button-background-color);
              border: 1px solid var(--button-border-color);
              transition: background-color 0.5s, color 0.5s, border-color 0.5s;
            }
          </style>
          <link rel="stylesheet" href="/systems/dcc/probe.css">
          <div id="target"><button>Target</button></div>
          <div id="controls">
            <button style="transition-duration: 0.5s !important; padding: 3px !important">Generic button</button>
            <a class="button" style="transition: color 0.5s !important; margin: 2px">Generic anchor</a>
          </div>
        `
        })
      })
      await page.goto('http://scope-probe.test/')
      if (running) {
        await page.evaluate(async () => {
          const controls = [...document.querySelectorAll('#controls > *')]
          for (const el of controls) {
            el.style.setProperty('--button-text-color', '#123456', 'important')
            getComputedStyle(el).getPropertyValue('color') // Start a real paint transition before comparison.
          }
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        })
        expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0)
      }
      const before = await snapshot(page)
      expect(before.inline.every(el => el.transition.includes('0.5s'))).toBe(true)
      const result = await page.evaluate(compareChatButtonScope, specimens)
      expect(await snapshot(page), 'rules, inline values/priorities and transitions restored').toEqual(before)
      expect(result.mutationCount).toBeGreaterThan(0)
      if (broad) {
        // A running inline text override still leaves broad background/border paint.
        expect(result.enabled['generic-chat'][0]).not.toEqual(result.disabled['generic-chat'][0])
        expect(result.enabled['generic-chat'][1]).not.toEqual(result.disabled['generic-chat'][1])
      } else {
        expect(result.enabled).toEqual(result.disabled)
      }
      if (running) {
        expect(result.enabled['generic-chat'].map(el => el.color), 'baseline settles existing transitions').toEqual([
          'rgb(18, 52, 86)', 'rgb(18, 52, 86)'
        ])
      }
      if (broad && !running) {
        // Exercise finally after CSS declarations have actually been removed.
        await page.evaluate(() => {
          const root = document.getElementById('controls')
          let reads = 0
          root.querySelectorAll = function (selector) {
            if (++reads === 3) throw new Error('probe disabled-paint read failure')
            return Element.prototype.querySelectorAll.call(this, selector)
          }
        })
        await expect(page.evaluate(compareChatButtonScope, specimens)).rejects.toThrow('probe disabled-paint read failure')
        await page.evaluate(() => { delete document.getElementById('controls').querySelectorAll })
        expect(await snapshot(page), 'failed measurement also restores all declarations').toEqual(before)
      }
    })
  }
}
