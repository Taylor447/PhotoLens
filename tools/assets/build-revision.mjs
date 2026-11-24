import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

export function buildRevision() {
 let checkout = null;
 try {
  checkout = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 } catch { /* A source archive can be built without Git metadata. */ }
 const event = process.env.GITHUB_EVENT_PATH;
 const pullRequest = event && JSON.parse(readFileSync(event,'utf8')).pull_request;
 const source = process.env.PHOTOLENS_PREVIEW_SHA || pullRequest?.head?.sha || checkout;
 return {
  name:'photolens-build-revision',
  generateBundle() {
   this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify({
    sourceCommit:/^[0-9a-f]{40}$/.test(source) ? source : null,
    checkoutCommit:checkout,
    pullRequest:pullRequest?.number || null
   },null,2)+'\n'});
  }
 };
}

