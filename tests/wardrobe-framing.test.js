import test from 'node:test';
import assert from 'node:assert/strict';
import {framedCameraDistance,lensVerticalFov} from '../features/wardrobe/studio3d/camera-framing.js';
test('the full mannequin fits narrow and long-lens viewports',()=>{for(const [aspect,focal] of [[1.4,50],[.65,85]]){const distance=framedCameraDistance({heightCm:170,widthCm:110,aimCm:85,cameraHeightCm:135,aspect,focalLengthMm:focal});const halfVisibleHeight=distance*Math.tan(lensVerticalFov(focal,aspect)*Math.PI/360);const halfVisibleWidth=halfVisibleHeight*aspect;assert.ok(halfVisibleHeight>=170*.58);assert.ok(halfVisibleWidth>=110*.58);assert.ok(distance<=1200);}assert.ok(framedCameraDistance({aspect:.65,focalLengthMm:85})>framedCameraDistance({aspect:1.4,focalLengthMm:50}));});
