import { describe, expect, it } from 'vitest';
import { compareDeviceFields, scoreDevice, scorePhotoConditions, bestForecastHours, estimateGoldenWindows, suggestAngles, suggestOutfits, planStore } from './photography.js';

describe('PhotoLens field-grounded planning logic', () => {
  it('does not invent device values and hides absent differences', () => {
    const devices = [{sensor:{megapixels:null}},{sensor:{megapixels:24}}];
    expect(compareDeviceFields(devices,[{path:'sensor.megapixels',label:'MP'}],true)).toEqual([]);
    expect(compareDeviceFields(devices,[{path:'sensor.megapixels',label:'MP'}])[0].values).toEqual([null,24]);
  });

  it('only returns a purpose score when enough numeric facts exist', () => {
    const config={purposes:{travel:{'sensor.megapixels':{min:0,max:50,weight:.5,direction:'higher'},'power.weightG':{min:100,max:1000,weight:.5,direction:'lower'}}}};
    expect(scoreDevice({sensor:{megapixels:25},power:{weightG:null}},'travel',config).score).toBeNull();
    expect(scoreDevice({sensor:{megapixels:25},power:{weightG:550}},'travel',config).score).toBe(50);
  });

  it('scores only from present weather variables and explains the result', () => {
    const result=scorePhotoConditions({rainProbability:0,windSpeed:5,cloudCover:30},'portrait');
    expect(result.score).toBeGreaterThan(0);
    expect(result.explanation).toContain('mưa');
    expect(scorePhotoConditions({},'portrait').score).toBeNull();
  });

  it('ranks future forecast hours and ignores past hours', () => {
    const localClock = value => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}T${String(value.getHours()).padStart(2,'0')}:${String(value.getMinutes()).padStart(2,'0')}`;
    const future=localClock(new Date(Date.now()+3600000));
    const past=localClock(new Date(Date.now()-3600000));
    const result=bestForecastHours({time:[past,future],precipitation_probability:[80,0],cloud_cover:[90,30],wind_speed_10m:[20,4],visibility:[5000,20000],uv_index:[1,3]});
    expect(result).toHaveLength(1);
    expect(result[0].time).toBe(future);
  });

  it('marks golden-hour windows as estimates', () => {
    const windows=estimateGoldenWindows('2026-11-22T06:00:00+07:00','2026-11-22T17:00:00+07:00');
    expect(windows.estimated).toBe(true);
    expect(windows.morningGolden).toBeTruthy();
  });

  it('provides three angle and outfit alternatives without appearance fields', () => {
    const angles=suggestAngles('architecture','tòa nhà');
    const outfits=suggestOutfits({temperature:31,precipitation:0,wind:5,background:'#456789'});
    expect(angles).toHaveLength(3);
    expect(outfits).toHaveLength(3);
    expect(JSON.stringify(outfits)).not.toMatch(/skin|gender|age|body/i);
  });

  it('stores, updates and removes plans locally', () => {
    const values=new Map();const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
    const repository=planStore(storage);const first=repository.save({title:'Test'});
    expect(repository.list()).toHaveLength(1);
    repository.save({...first,title:'Updated'});
    expect(repository.list()[0].title).toBe('Updated');
    repository.remove(first.id);expect(repository.list()).toHaveLength(0);
  });
});
