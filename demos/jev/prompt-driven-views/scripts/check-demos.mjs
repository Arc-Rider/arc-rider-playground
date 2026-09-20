import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';

const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});
let browser;
try{
  await server.listen();
  const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/minimal-table-live`,{waitUntil:'networkidle'});
  await page.locator('#minimal-live-board').waitFor();
  await page.getByRole('button',{name:'Schema ↗'}).click();
  await page.getByText('How the properties reach the widget').waitFor();
  await page.locator('.minimal-live-drawer-head button').click();
  await page.getByRole('link',{name:'Smart Kanban ↗'}).click();
  await page.locator('#smart-live-board').waitFor();
  await page.getByRole('link',{name:'Board ↔ Table ↗'}).click();
  await page.locator('#minimal-live-board').waitFor();
  assert.deepEqual(errors,[]);
  console.log('Both live demos render and navigate without browser errors.');
}finally{
  await browser?.close();
  await server.close();
}
