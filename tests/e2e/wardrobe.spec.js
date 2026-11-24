import {test,expect} from '@playwright/test';

const categoryLabels={tops:'Áo',bottoms:'Quần',skirts:'Váy',dresses:'Váy / đầm',outerwear:'Áo khoác',shoes:'Giày dép',hats:'Mũ',bags:'Túi',eyewear:'Kính',scarves:'Khăn',jewelry:'Trang sức',hair:'Phụ kiện tóc'};

async function openStudio(page,section='studio2d'){
 await page.goto('./');
 await expect(page.getByRole('heading',{name:'Chào mừng đến với PhotoLens'})).toBeVisible();
 await page.getByRole('button',{name:'Bắt đầu'}).click();
 await expect(page.locator('.modal-backdrop')).toHaveCount(0);
 await page.locator('#photoPlannerButton').click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.locator('[data-tab="outfit"]').click();
 const tabSection=section==='catalog'?'wardrobe':section;
 await page.locator('[data-wardrobe-section="'+tabSection+'"]').click();
 await expect(page.locator('[data-ws-app]')).toBeVisible();
 await expect(page.locator('[data-ws-section="'+section+'"]')).toBeVisible();
}

test('all catalog cards load their matching category thumbnail under the GitHub Pages base',async({page})=>{
 const responses=[];
 page.on('response',response=>{if(response.url().includes('/assets/wardrobe/previews/'))responses.push({url:response.url(),status:response.status()});});
 await openStudio(page,'catalog');
 const cards=page.locator('[data-ws-draggable]');
 await expect(cards).toHaveCount(60);
 const report=await cards.evaluateAll(async nodes=>{
  const images=nodes.map(node=>node.querySelector('.ws-thumb img'));
  for(const image of images){image.loading='eager';await image.decode();}
  return nodes.map((node,index)=>({id:node.dataset.wsDraggable,src:images[index]?.getAttribute('src')||'',alt:images[index]?.alt||'',width:images[index]?.naturalWidth||0,label:node.querySelector('small')?.textContent||''}));
 });
 expect(report).toHaveLength(60);
 expect(new Set(report.map(x=>x.src)).size).toBe(60);
 for(const card of report){
  expect(card.src).toBe('/PhotoLens/assets/wardrobe/previews/'+card.id+'.svg');
  expect(card.width).toBeGreaterThan(0);
  const category=Object.values(categoryLabels).find(label=>card.label.startsWith(label+' ·'));
  expect(category,card.id+' category label').toBeTruthy();
  expect(card.alt).toContain('Xem trước '+category+':');
 }
 await expect.poll(()=>responses.length).toBe(60);
 expect(responses.every(response=>response.status===200)).toBeTruthy();
});

test('fixed outfit switches 2D and 3D, handles context loss, saves Lookbook and exports PNG',async({page},testInfo)=>{
 await openStudio(page);
 const card=page.locator('[data-ws-draggable="tpl-tops-1"]');
 await card.scrollIntoViewIfNeeded();
 await card.getByRole('button',{name:'Mặc thử'}).click();
 await expect(page.locator('.ws-stage svg [data-garment="closet-tpl-tops-1"]')).toBeVisible();

 const stage2d=page.locator('.ws-stage');
 const image2d=await stage2d.screenshot();
 await testInfo.attach('wardrobe-studio-2d.png',{body:image2d,contentType:'image/png'});
 expect((await stage2d.screenshot()).equals(image2d)).toBeTruthy();

 await page.locator('[data-wardrobe-section="studio3d"]').click();
 const canvas=page.locator('.ws-three-host canvas');
 await expect(canvas).toBeVisible({timeout:30_000});
 await expect.poll(()=>canvas.evaluate(node=>Boolean(node.getContext('webgl2')))).toBeTruthy();
 const image3d=await page.locator('.ws-stage').screenshot();
 await testInfo.attach('wardrobe-studio-3d.png',{body:image3d,contentType:'image/png'});
 expect((await page.locator('.ws-stage').screenshot()).equals(image3d)).toBeTruthy();

 await canvas.evaluate(node=>node.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 await expect(page.locator('[data-wardrobe-section="studio2d"]')).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.ws-stage svg [data-garment="closet-tpl-tops-1"]')).toBeVisible();

 await page.locator('[data-ws-look-name]').fill('E2E · Áo cơ bản');
 await page.locator('[data-ws-look-tags]').fill('e2e, thumbnail');
 await page.locator('[data-ws-save-look]').click();
 await expect(page.locator('[data-ws-message]')).toContainText('Đã lưu bộ phối');

 await page.locator('[data-wardrobe-section="lookbook"]').click();
 const saved=page.locator('.ws-look-card').filter({hasText:'E2E · Áo cơ bản'});
 await expect(saved).toBeVisible();
 const download=page.waitForEvent('download');
 await saved.getByRole('button',{name:'PNG',exact:true}).click();
 const file=await download;
 expect(file.suggestedFilename()).toMatch(/\.png$/i);
});

test('offline AI compose falls back to the deterministic local rules engine',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('photolens_ai_enabled','true');
  localStorage.setItem('photolens_worker_url','https://worker.invalid');
 });
 await openStudio(page);
 await page.context().setOffline(true);
 await page.locator('[data-ws-ai]').click();
 await expect(page.locator('[data-ws-message]')).toContainText('Đã phối theo quy tắc cục bộ',{timeout:15_000});
 expect(await page.locator('.ws-stage svg [data-garment]').count()).toBeGreaterThan(0);
});

test('mid-range Android emulation keeps the canvas first and the closet in a reachable bottom tray',async({page},testInfo)=>{
 await page.setViewportSize({width:412,height:915});
 const client=await page.context().newCDPSession(page);
 await client.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:4});
  Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:4});
 });
 const started=Date.now();
 await openStudio(page);
 await expect(page.locator('.ws-stage svg')).toBeVisible();
 const renderMs=Date.now()-started;
 const geometry=await page.evaluate(()=>{
  const main=document.querySelector('.ws-layout-studio>.ws-main');
  const closet=document.querySelector('.ws-layout-studio>.ws-closet-panel');
  return {viewport:innerWidth,viewportHeight:innerHeight,document:document.documentElement.scrollWidth,canvasOrder:Number(getComputedStyle(main).order),closetOrder:Number(getComputedStyle(closet).order),closetPosition:getComputedStyle(closet).position,closetMaxHeight:getComputedStyle(closet).maxHeight,stageHeight:document.querySelector('.ws-stage').getBoundingClientRect().height};
 });
 expect(renderMs).toBeLessThan(10_000);
 expect(geometry.document).toBeLessThanOrEqual(geometry.viewport);
 expect(geometry.canvasOrder).toBeLessThan(geometry.closetOrder);
 expect(geometry.closetPosition).toBe('sticky');
 expect(parseFloat(geometry.closetMaxHeight)).toBeGreaterThan(0);
 expect(geometry.stageHeight).toBeGreaterThanOrEqual(915*.5);
 await testInfo.attach('android-emulation.png',{body:await page.screenshot(),contentType:'image/png'});
 await testInfo.attach('android-emulation-metrics.json',{body:Buffer.from(JSON.stringify({viewport:'412x915',cpuThrottle:4,deviceMemoryGb:4,studioRenderMs:renderMs,...geometry},null,2)),contentType:'application/json'});
});
