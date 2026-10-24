/* 첨부한 원본 PNG로 열차 통과와 나무 4단계 성장을 비교하는 test 탭. */
window.createCarbonTestForest=(card,base,count=36)=>{
  const scene=document.createElement('div');scene.className='carbon-test-forest';scene.hidden=true;
  scene.setAttribute('aria-label',`기차가 지나간 뒤 나무 ${count}그루가 자라는 애니메이션`);
  const grid=document.createElement('div');grid.className='test-tree-grid';grid.setAttribute('aria-hidden','true');
  const train=new Image();train.className='test-asset-train';train.src=base+'train_itx_maum.png';train.alt='ITX-마음';train.hidden=true;
  scene.append(grid,train);card.append(scene);
  const files=['tree_stage_01_sprout.png','tree_stage_02_sapling.png','tree_stage_03_young.png','tree_stage_04_mature.png'];
  const assets=files.map(file=>{const image=new Image();image.src=base+file;return image;});
  const trees=Array.from({length:count},()=>{const image=new Image();image.className='test-tree';image.alt='';image.dataset.stage='0';image.src=assets[0].src;grid.append(image);return image;});
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,revision=0;
  function setStage(tree,stage){
    if(Number(tree.dataset.stage)===stage)return;
    tree.dataset.stage=String(stage);
    if(stage>0)tree.src=assets[stage-1].src;
  }
  function stop(){revision++;cancelAnimationFrame(frame);train.hidden=true;scene.hidden=true;}
  async function play(){
    stop();const version=revision;scene.hidden=false;
    trees.forEach(tree=>setStage(tree,0));
    try{await Promise.all([train,...assets].map(image=>image.decode()));}
    catch{if(version===revision){trees.forEach(tree=>setStage(tree,4));scene.setAttribute('aria-label','일부 이미지를 불러오지 못했어요.');}return;}
    if(version!==revision)return;
    if(!trees.length)return;
    const width=scene.clientWidth,trainWidth=Math.min(width,300);
    train.style.width=trainWidth+'px';
    function showStill(){
      trees.forEach(tree=>setStage(tree,4));
      train.style.transform=`translate(${(width-trainWidth)/2}px,0px)`;train.hidden=false;
    }
    if(motion.matches){showStill();return;}
    const rect=scene.getBoundingClientRect(),rows=new Map(),positions=new Map();
    trees.forEach(tree=>{
      const r=tree.getBoundingClientRect(),top=Math.round(r.top-rect.top);
      if(!rows.has(top))rows.set(top,[]);
      rows.get(top).push(tree);positions.set(tree,r.left-rect.left+r.width/2);
    });
    const entries=[...rows.entries()],duration=3000;let start;
    train.hidden=false;
    const tick=now=>{
      if(version!==revision)return;
      if(motion.matches){showStill();return;}
      if(start===undefined)start=now;
      const elapsed=now-start,row=Math.min(entries.length-1,Math.floor(elapsed/duration));
      const progress=Math.min(1,(elapsed-row*duration)/duration);
      const tail=-(trainWidth+4)+progress*(width+trainWidth+100);
      train.style.transform=`translate(${tail}px,${entries[row][0]-8}px)`;
      entries.forEach(([,items],i)=>items.forEach(tree=>{
        const passed=tail-positions.get(tree);
        setStage(tree,i<row?4:i>row?0:passed<=0?0:Math.min(4,1+Math.floor(passed/20)));
      }));
      if(elapsed<entries.length*duration)frame=requestAnimationFrame(tick);
      else{trees.forEach(tree=>setStage(tree,4));train.hidden=true;}
    };
    frame=requestAnimationFrame(tick);
  }
  return {play,stop,destroy(){stop();scene.remove();}};
};
