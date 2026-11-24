const byCategory = {
  tops: [
    {neck:'crew', sleeve:'short', hem:.68},
    {neck:'shirt', sleeve:'long', hem:.92, closure:'placket'},
    {neck:'high', sleeve:'long', hem:1.38, closure:'diagonal', panels:'long'},
    {neck:'shirt', sleeve:'long', hem:1.28, closure:'placket', pockets:true},
    {neck:'high', sleeve:'short', hem:.33, closure:'armor'}
  ],
  outerwear: [
    {neck:'shirt', sleeve:'long', hem:.35, closure:'open'},
    {neck:'v', sleeve:'long', hem:1.28, closure:'lapels'},
    {neck:'high', sleeve:'sleeveless', hem:1.2, panels:'cape'},
    {neck:'high', sleeve:'long', hem:.73, closure:'zip'},
    {neck:'high', sleeve:'wide', hem:1.43, closure:'diagonal'}
  ],
  dresses: [
    {neck:'crew', sleeve:'sleeveless', hem:.30, skirt:.56, flare:5},
    {neck:'square', sleeve:'short', hem:.30, skirt:.55, flare:12},
    {neck:'v', sleeve:'long', hem:.33, skirt:.82, flare:11, closure:'open'},
    {neck:'square', sleeve:'wide', hem:.30, skirt:.75, flare:18, closure:'armor', pleats:6},
    {neck:'v', sleeve:'sleeveless', hem:.32, skirt:.65, flare:8}
  ],
  bottoms: [
    {rise:.71, inseam:.98, taper:.35},
    {rise:.75, inseam:.94, taper:.05, cuffs:true},
    {rise:.64, inseam:.42, taper:.42},
    {rise:.80, inseam:1, taper:.95},
    {rise:.57, inseam:.93, taper:.37, armor:true}
  ],
  skirts: [
    {skirt:.48, flare:9, pleats:0},
    {skirt:.53, flare:10, pleats:6},
    {skirt:.58, flare:16, pleats:4},
    {skirt:.86, flare:7, pleats:0},
    {skirt:.57, flare:4, pleats:0}
  ]
};

export function catalogVariant(item){
  const prefix = 'tpl-' + item.category + '-';
  const id = (item.assets?.thumbnail?.id || item.id || '').replace(/^(thumbnail:|closet-)/,'');
  return id.startsWith(prefix) && /^[1-5]$/.test(id.slice(prefix.length)) ? Number(id.at(-1))-1 : 0;
}

export function garmentCut(item){
  const variant = catalogVariant(item);
  const cut = byCategory[item.category]?.[variant];
  if (!cut) return null;
  // Stored copies of a library template also have the legacy builder defaults.
  const parameters = item.isTemplate ? {} : item.parameters || {};
  const length = {short:.82,long:1.17}[parameters.length] || 1;
  const width = {slim:1.95,wide:3.45}[parameters.width] || 2.55;
  return {...cut,length,width,neck:parameters.neck || cut.neck,
    sleeve:parameters.sleeve || cut.sleeve,pleats:parameters.pleats || cut.pleats};
}
