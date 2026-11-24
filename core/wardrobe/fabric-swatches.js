// Original tileable SVG artwork. Coordinates repeat on a 10-unit tile.
const stroke = (d, width = 1) => '<path d="'+d+'" fill="none" stroke="white" stroke-width="'+width+'"/>';
const fill = d => '<path d="'+d+'" fill="white"/>';
const dot = (x,y,r) => '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="white"/>';
const flower = '<path d="M5 5C-1 -1 6 -1 5 5C10 -1 13 6 5 5C11 11 5 13 5 5C1 11 -2 6 5 5Z" fill="white"/>';
const tiles = {
 solid:'', 'thin-stripe':stroke('M2 0v10M7 0v10',.7), 'wide-stripe':stroke('M4 0v10',3),
 pinstripe:stroke('M2 0v10M3.5 0v10',.35), 'vertical-stripe':stroke('M5 0v10',1.6),
 'horizontal-stripe':stroke('M0 4h10',1.6), gingham:stroke('M3 0v10M0 3h10',3),
 plaid:stroke('M2 0v10M8 0v10M0 3h10',1.8)+stroke('M5 0v10M0 6h10',.5),
 windowpane:stroke('M.5 0v10M0 .5h10',.65),
 houndstooth:fill('M0 0h4l2 2h3L6 5l2 3-4-2-3 3V6H0Z'),
 'polka-small':dot(2.5,2.5,1)+dot(7.5,7.5,1), 'polka-large':dot(5,5,3), 'micro-dot':dot(3,3,.5)+dot(8,8,.5),
 'floral-small':'<g transform="scale(.5)">'+flower+'</g><g transform="translate(5 5) scale(.45)">'+flower+'</g>',
 'floral-large':flower+dot(5,5,1), botanical:stroke('M0 10Q3 4 10 0M3 6Q0 1 6 4M5 4Q9 5 9 2',.85),
 tropical:fill('M1 10Q6 0 9 1L7 4 10 3 7 6 4 6 5 8Z'),
 abstract:fill('M0 0h3L0 6Zm4 6q2-6 5 0l-3 3Z'), geometric:stroke('m1 6 3-5 3 5Z M7 7h2v2H7Z'),
 chevron:stroke('M-5 0 0 5 5 0 10 5 15 0M-5 5 0 10 5 5 10 10 15 5'),
 wave:stroke('M-5 5Q-2.5 0 0 5T5 5T10 5T15 5'), diamond:stroke('M5 0 10 5 5 10 0 5Z'),
 argyle:fill('M5 0 8 5 5 10 2 5Z')+stroke('M-5 0 5 10 15 0',.5),
 paisley:stroke('M7 1Q1 1 2 6Q4 10 7 8Q10 6 6 4Q4 4 5 6Q2 4 7 1Z',.8),
 camouflage:fill('M0 2 3 1 4 4 8 3 9 6 4 7 1 5Zm6 7 2-2 2 2Z'),
 'camo-soft':fill('M1 2Q3 0 5 3T9 3Q11 7 7 7T3 6Q0 7 1 2Z'),
 'pixel-grid':fill('M1 1h3v3H1Zm5 3h2v3H6ZM0 8h3v2H0Z'),
 checker:fill('M0 0h5v5H0Zm5 5h5v5H5Z'), 'color-block':fill('M0 0h6L3 10H0Z'),
 gradient:'<path d="M0 0h10v2H0Z" fill="white" opacity=".9"/><path d="M0 2h10v3H0Z" fill="white" opacity=".55"/><path d="M0 5h10v3H0Z" fill="white" opacity=".25"/>',
 speckle:dot(2,3,.7)+dot(8,6,.85)+dot(4,9,.46)+dot(6,1,.33),
 brush:fill('M0 8 8 1 5 5 10 2 6 7 2 9Z'), marble:stroke('M1 0Q5 3 2 4T6 10M3 4 7 3 9 0',.65),
 ikat:fill('M5 0 6 3 8 2 8 4 10 5 7 6 8 8 6 7 5 10 4 7 2 8 3 6 0 5 3 4 2 2 4 3Z'),
 batik:stroke('M5 0Q5 5 0 5Q5 5 5 10Q5 5 10 5Q5 5 5 0Z')+dot(5,5,.65),
 embroidered:stroke('M1 8 3 6m1-1 2-2m1-1 1-1M2 4l2 2m2 0 2 2',1.3),
 'lace-motif':stroke('M0 0Q5 7 10 0M0 10Q5 3 10 10M0 5Q2.5 2 5 5T10 5',.65),
 star:fill('M5 1 6.2 4 9.5 4 7 6 8 9 5 7.3 2 9 3 6 .5 4 3.8 4Z'),
 moon:fill('M7 1A4 4 0 1 0 8 8Q2 7 7 1Z'),
 cloud:fill('M1 7Q-1 4 2.5 4Q4 0 6 3Q10 2 9 5Q12 8 7 8H2Z')
};
export function patternTile(id) {
 return Object.hasOwn(tiles,id) ? tiles[id] : '';
}

// Illustration presets control the visible sheen and weave, not measured optical properties.
const fine = stroke('M0 2h10M3 0v10',.4), diagonal = stroke('M-2 2 2-2M0 10 10 0M8 12l4-4',.8);
const cross = stroke('M0 3h10M3 0v10',.85), loop = stroke('M0 0q5 7 10 0M0 5q5 7 10 0',.8);
const finishes = {
 cotton:[.15,fine,.11], linen:[.20,cross,.22], denim:[.16,diagonal,.32], wool:[.12,loop,.32],
 silk:[.58,'',0], leather:[.42,stroke('M0 7q3-4 6-1l4-2',.55),.15], polyester:[.31,fine,.13],
 nylon:[.38,cross,.11], viscose:[.34,diagonal,.10], satin:[.69,'',0], twill:[.19,diagonal,.25],
 jersey:[.18,loop,.16], canvas:[.11,cross,.30], chiffon:[.32,cross,.08],
 velvet:[.43,stroke('M1 1v2m3 1v2m3 1v2',.75),.24], fleece:[.09,loop,.23],
 technical:[.30,stroke('M1 0v10M0 1h10',.8),.24], knit:[.13,loop,.4],
 lace:[.19,tiles['lace-motif'],.37], tulle:[.22,tiles.diamond,.18]
};
export function fabricFinish(id) {
 return Object.hasOwn(finishes,id) ? finishes[id] : [.18,'',0];
}

