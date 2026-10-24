/* 계절별 열차 이미지 이동. PNG 모델과 독립 SVG 미리보기를 함께 지원한다. */
(()=>{
  const trains={spring:['봄','ITX-마음'],summer:['여름','KTX-청룡'],autumn:['가을','KTX-산천'],winter:['겨울','광역전철 전동차']};
  const month=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',month:'numeric'}).format(new Date()));
  const current=month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter';
  document.querySelectorAll('[data-seasonal-train]').forEach(card=>{
    const base=card.dataset.trainBase||'asset/seasonal-trains/';
    const modelBase=card.dataset.trainModelBase;
    const models={maum:['ITX-마음','itx_maum.png'],cheongryong:['KTX-청룡','ktx_cheongRyong.png'],sancheon:['KTX-산천','ktx_sancheon.png'],metro:['광역전철','jeondong.png'],ktx:['KTX','ktx.png']};
    const seasonalModels={spring:'maum',summer:'cheongryong',autumn:'sancheon',winter:'metro'};
    const tabs=card.querySelector('.train-season-tabs'),lane=card.querySelector('.train-lane');
    if(!tabs||!lane)return;
    let revision=0;
    let selectedSeason=current;
    let modelSelect;
    if(modelBase){
      card.classList.add('uses-train-model');
      const label=document.createElement('label');label.className='train-model-picker';
      label.append(document.createTextNode('열차'));
      modelSelect=document.createElement('select');modelSelect.setAttribute('aria-label','지나가는 열차 선택');
      modelSelect.innerHTML=Object.entries(models).map(([key,[name]])=>`<option value="${key}">${name}</option>`).join('');
      label.append(modelSelect);tabs.after(label);
      modelSelect.addEventListener('change',()=>play(selectedSeason,modelSelect.value));
    }
    tabs.innerHTML=Object.entries(trains).map(([season,[name]])=>`<button type="button" data-train-pick="${season}" aria-pressed="false">${name}</button>`).join('');
    const sources=modelBase?Object.values(models).map(([,file])=>modelBase+file):Object.keys(trains).map(season=>base+'train-'+season+'.svg');
    sources.forEach(src=>{const image=new Image();image.src=src;});
    async function play(season,model=seasonalModels[season]){
      const version=++revision;
      selectedSeason=season;
      card.dataset.trainSeason=season;
      if(modelSelect)modelSelect.value=model;
      tabs.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.trainPick===season)));
      const runner=document.createElement('div');runner.className='train-runner';
      const image=new Image();image.alt=(modelBase?models[model][0]:trains[season][1])+' 측면 일러스트';
      image.src=modelBase?modelBase+models[model][1]:base+'train-'+season+'.svg';
      if(modelBase){
        const sprite=document.createElement('div');sprite.className='train-sprite';sprite.append(image);runner.append(sprite);
      }else{image.width=160;image.height=40;runner.append(image);}
      lane.replaceChildren(runner);
      try{await image.decode();}catch{if(version===revision)lane.textContent='열차 이미지를 불러오지 못했어요.';return;}
      if(version!==revision)return;
      requestAnimationFrame(()=>{if(version===revision)runner.classList.add('is-running');});
    }
    tabs.addEventListener('click',event=>{const button=event.target.closest('button[data-train-pick]');if(button)play(button.dataset.trainPick);});
    play(current);
  });
})();
