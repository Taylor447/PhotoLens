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

async function stableScreenshot(locator){
 await locator.evaluate(async()=>{
  await document.fonts.ready;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 });
 let previous;
 await expect.poll(async()=>{
  const screenshot=await locator.screenshot({animations:'disabled'});
  const stable=Boolean(previous?.equals(screenshot));
  previous=screenshot;
  return stable;
 },{timeout:8_000}).toBe(true);
 return previous;
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

for(const [device,width,height] of [['desktop',1440,980],['mobile',412,915]]){
 test('all card images render distinct pixels and clear their labels on '+device,async({page},testInfo)=>{
  await page.setViewportSize({width,height});
  await openStudio(page,'catalog');
  const cards=page.locator('.ws-item-card');
  await expect(cards).toHaveCount(60);
  const measured=await cards.evaluateAll(async cards=>{
   const images=cards.map(card=>card.querySelector('img'));
   images.forEach(img=>{img.loading='eager';});
   await Promise.all(images.map(img=>img.decode()));
   const canvas=document.createElement('canvas');
   canvas.width=120;canvas.height=112;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   return cards.map((card,i)=>{
    const img=images[i],name=card.querySelector('b');
    ctx.clearRect(0,0,120,112);ctx.drawImage(img,0,0,120,112);
    return {id:card.dataset.wsDraggable,name:name.textContent,
     gap:name.getBoundingClientRect().top-img.getBoundingClientRect().bottom,
     height:card.getBoundingClientRect().height,pixels:canvas.toDataURL()};
   });
  });
  expect(new Set(measured.map(x=>x.pixels)).size).toBe(60);
  expect(new Set(measured.map(x=>x.height)).size).toBe(1);
  for(const item of measured){
   expect(item.gap,item.id).toBeGreaterThanOrEqual(4);
   expect(item.name,item.id).not.toMatch(/[?\uFFFD]/u);
  }
  await cards.first().scrollIntoViewIfNeeded();
  await testInfo.attach('catalog-'+device+'.png',{body:await page.screenshot(),contentType:'image/png'});
 });
}

test('a missing static thumbnail recovers the same garment outline',async({page})=>{
 await page.route('**/assets/wardrobe/previews/tpl-bottoms-1.svg',route=>route.fulfill({status:404,body:''}));
 await openStudio(page,'catalog');
 const card=page.locator('[data-ws-draggable="tpl-bottoms-1"]');
 await card.scrollIntoViewIfNeeded();
 await expect(card.locator('svg[data-garment-id="tpl-bottoms-1"] [data-region="main"]')).toBeVisible();
 await expect(card.locator('[data-placeholder-category]')).toHaveCount(0);
});

test('fixed outfit switches 2D and 3D, handles context loss, saves Lookbook and exports PNG',async({page},testInfo)=>{
 await openStudio(page);
 const card=page.locator('[data-ws-draggable="tpl-tops-1"]');
 await card.scrollIntoViewIfNeeded();
 await card.getByRole('button',{name:'Mặc thử'}).click();
 await expect(page.locator('.ws-stage svg [data-garment="closet-tpl-tops-1"]')).toBeVisible();

 const stage2d=page.locator('.ws-stage');
 const image2d=await stableScreenshot(stage2d);
 await testInfo.attach('wardrobe-studio-2d.png',{body:image2d,contentType:'image/png'});

 await page.locator('[data-wardrobe-section="studio3d"]').click();
 const canvas=page.locator('.ws-three-host canvas');
 await expect(canvas).toBeVisible({timeout:30_000});
 await expect.poll(()=>canvas.evaluate(node=>Boolean(node.getContext('webgl2')))).toBeTruthy();
 const image3d=await stableScreenshot(page.locator('.ws-stage'));
 await testInfo.attach('wardrobe-studio-3d.png',{body:image3d,contentType:'image/png'});

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

test('continuous mannequin renders each pose and rotates in the Studio 3D canvas',async({page},testInfo)=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await openStudio(page,'studio3d');
 await page.locator('[data-ws-preset]').selectOption('reference-d');
 await expect(page.locator('[data-ws-height]')).toHaveValue('165');
 const canvas=page.locator('.ws-three-host canvas');
 const capture=async name=>{
  await expect(canvas).toBeVisible({timeout:15_000});
  const screenshot=await stableScreenshot(canvas);
  await testInfo.attach(name+'.png',{body:screenshot,contentType:'image/png'});
  return screenshot;
 };
 const front=await capture('mannequin-standing-front');
 await expect.poll(()=>canvas.evaluate(node=>Boolean(node.getContext('webgl2')))).toBeTruthy();
 for(let i=0;i<6;i++)await canvas.press('ArrowRight');
 expect((await capture('mannequin-standing-oblique')).equals(front)).toBe(false);
 const poses=new Set([front.toString('base64')]);
 for(const pose of ['lean','step','sitting']){
  await page.locator('[data-ws-pose="'+pose+'"]').click();
  poses.add((await capture('mannequin-'+pose)).toString('base64'));
 }
 expect(poses.size).toBe(4);

 await page.locator('[data-ws-cloth]').uncheck();
 const bareSitting=await capture('mannequin-sitting-no-cloth');
 await page.locator('[data-ws-wear="tpl-skirts-2"]').click();
 const skirt=await capture('mannequin-sitting-pleated-skirt');
 expect(skirt.equals(bareSitting)).toBe(false);
 await page.locator('[data-ws-wear="tpl-bottoms-1"]').click();
 expect((await capture('mannequin-sitting-skirt-over-trousers')).equals(skirt)).toBe(false);
 expect(errors).toEqual([]);
});

test('a blazer, shirt and trousers render together without a layer intersection warning',async({page},testInfo)=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await openStudio(page,'catalog');
 for(const id of ['tpl-tops-2','tpl-bottoms-1','tpl-outerwear-2']){
  await page.locator('[data-ws-wear="'+id+'"]').click();
 }
 await page.locator('[data-wardrobe-section="studio3d"]').click();
 await page.locator('[data-ws-preset]').selectOption('reference-b');
 const canvas=page.locator('.ws-three-host canvas');
 await expect.poll(()=>canvas.evaluate(node=>Boolean(node.getContext('webgl2')))).toBeTruthy();
 for(const pose of ['standing','step','sitting']){
  await page.locator('[data-ws-pose="'+pose+'"]').click();
  const screenshot=await stableScreenshot(canvas);
  await expect(page.locator('[data-ws-message]')).not.toContainText('lớp giao nhau');
  await testInfo.attach('blazer-trousers-'+pose+'.png',{body:screenshot,contentType:'image/png'});
 }
 expect(errors).toEqual([]);
});

test('layered cape and skirt stay visible while the cloth worker sends accepted frames',async({page},testInfo)=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:8});
  Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:8});
  const BrowserWorker=window.Worker;
  window.Worker=class extends BrowserWorker{
   constructor(url,options){
    super(url,options);
    if(!String(url).includes('wardrobe-cloth'))return;
    window.clothRevisions=[];
    this.addEventListener('message',({data})=>{
     window.clothRevisions=data.map(frame=>frame.revision);
    });
   }
  };
 });
 await openStudio(page,'catalog');
 for(const id of ['tpl-tops-1','tpl-skirts-3','tpl-outerwear-3']){
  await page.locator('[data-ws-wear="'+id+'"]').click();
 }
 await page.locator('[data-wardrobe-section="studio3d"]').click();
 const canvas=page.locator('.ws-three-host canvas');
 await expect(canvas).toBeVisible({timeout:15_000});
 await page.locator('[data-ws-cloth]').check();
 await expect.poll(()=>page.evaluate(()=>window.clothRevisions?.filter(value=>value>=2).length??0),{timeout:20_000}).toBe(2);
 await expect(page.locator('[data-ws-message]')).not.toContainText('lớp giao nhau');
 await testInfo.attach('cape-skirt-cloth.png',{body:await canvas.screenshot(),contentType:'image/png'});
 expect(errors).toEqual([]);
});

test('seated áo dài, wide trousers and coat clear the overlap at the low-detail setting',async({page},testInfo)=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:412,height:915});
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:4});
  Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:4});
 });
 await openStudio(page,'catalog');
 for(const id of ['tpl-tops-3','tpl-bottoms-4','tpl-outerwear-1']){
  await page.locator('[data-ws-wear="'+id+'"]').click();
 }
 await page.locator('[data-wardrobe-section="studio3d"]').click();
 await page.locator('[data-ws-preset]').selectOption('reference-b');
 await page.locator('[data-ws-pose="sitting"]').click();
 const canvas=page.locator('.ws-three-host canvas');
 await expect(canvas).toBeVisible({timeout:15_000});
 const screenshot=await stableScreenshot(canvas);
 await expect(page.locator('[data-ws-message]')).not.toContainText('lớp giao nhau');
 await testInfo.attach('seated-ao-dai-trousers-coat-mobile.png',{body:screenshot,contentType:'image/png'});
 expect(errors).toEqual([]);
});

test('Garment Builder previews and saves a styled parameter variant',async({page})=>{
 await openStudio(page,'catalog');
 await page.getByText('Xưởng tạo biến thể tham số',{exact:true}).click();
 const form=page.locator('[data-ws-form="builder"]');
 await form.locator('[name="templateId"]').selectOption('tpl-skirts-1');
 await form.locator('[name="name"]').fill('Váy xếp ly kiểm thử');
 await form.locator('[name="patternId"]').selectOption({index:1});
 await form.locator('[name="materialId"]').selectOption({index:1});
 await form.locator('[name="color"]').evaluate(el=>{el.value='#8b5262';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await form.locator('[name="pleats"]').evaluate(el=>{el.value='3';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await form.locator('[name="trimColor"]').evaluate(el=>{el.value='#e0c080';el.dispatchEvent(new Event('input',{bubbles:true}));});
 const src=await form.locator('[data-ws-builder-preview]').getAttribute('src');
 const svg=decodeURIComponent(src.slice(src.indexOf(',')+1));
 expect(svg).toContain('data-region="trim"');
 expect((svg.match(/data-region="pleat"/g)||[])).toHaveLength(3);
 await form.getByRole('button',{name:'Tạo biến thể'}).click();
 const card=page.locator('.ws-item-card').filter({hasText:'Váy xếp ly kiểm thử'});
 await expect(card).toBeVisible();
 await expect(card.locator('.ws-thumb img')).toHaveAttribute('src',/^data:image\/svg\+xml/);
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
