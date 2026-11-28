import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/e2e',
 fullyParallel:false,
 retries:process.env.CI?1:0,
 timeout:60_000,
 reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
 use:{
  baseURL:'http://127.0.0.1:5173/PhotoLens/',
  browserName:'chromium',
  channel:'chrome',
  viewport:{width:1440,height:1000},
  trace:'retain-on-failure',
  screenshot:'only-on-failure',
  launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 },
 webServer:{
  command:'npm run dev -- --host 127.0.0.1',
  url:'http://127.0.0.1:5173/PhotoLens/',
  reuseExistingServer:!process.env.CI,
  timeout:120_000
 }
});
