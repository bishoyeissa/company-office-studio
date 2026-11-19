/* All dimensions are in metres. The desk index is the stable employee id. */
const OfficeScene = (() => {
  const seats = [];
  [[-8.8,-5.6,-2.4,0.8],[-8.8,-5.6,-2.4],[-8.8,-5.6,-2.4,0.8],[-8.8,-5.6,-2.4]].forEach((row,r) =>
    row.forEach(x => seats.push({x,z:4.55-r*3.15})));
  let deskCamera, camera, renderer, scene, view='desk', zoom=1, angle=.23, focus='all', redraw=()=>{}, onPick;
  const centers={all:[0,.6,0],team:[-4.7,1.2,-.2],meeting:[7,.95,-3.6],lounge:[7,.8,4]};
  const stage=document.querySelector('#stage'), holder=document.querySelector('#drawing');
  const labels=[], material=new Map(), geometry=new Map();
  function mesh(shape, color, x,y,z) {
    if (!material.has(color)) material.set(color,new THREE.MeshStandardMaterial({color,roughness:.81}));
    const obj=new THREE.Mesh(shape,material.get(color));
    obj.position.set(x,y,z); obj.castShadow=true;obj.receiveShadow=true;scene.add(obj);return obj;
  }
  function geom(key,create){if(!geometry.has(key))geometry.set(key,create());return geometry.get(key)}
  function box(x,y,z,w,h,d,c){const o=mesh(geom('box',()=>new THREE.BoxGeometry(1,1,1)),c,x,y,z);o.scale.set(w,h,d);return o}
  function cylinder(x,y,z,rt,rb,h,c,sides=14){return mesh(geom([rt,rb,h,sides].join('/'),()=>new THREE.CylinderGeometry(rt,rb,h,sides)),c,x,y,z)}
  function oval(x,y,z,w,h,d,c){const o=mesh(geom('oval',()=>new THREE.SphereGeometry(1,12,10)),c,x,y,z);o.scale.set(w,h,d);return o}
  const timber=0xbf8d5e,frame=0x283134,porcelain=0xe8e6d5;
  function plant(x,z,scale=1){
    cylinder(x,.35*scale,z,.45*scale,.29*scale,.7*scale,0xc2835b);
    for(let i=0;i<7;i++){const a=i*2.4;
      const l=oval(x+Math.cos(a)*.24*scale,(.88+(i%3)*.11)*scale,z+Math.sin(a)*.24*scale,.18*scale,.47*scale,.18*scale,[0x4b805e,0x749556,0x326e53][i%3]);l.rotation.z=-Math.cos(a)*.5;l.rotation.x=Math.sin(a)*.5;}
  }
  function chair(x,z,back=1,c=0x38685d){
    box(x,.32,z,.45,.62,.46,frame);box(x,.68,z,.85,.2,.82,c);
    box(x,1.03,z+.37*back,.85,.64,.16,c);
  }
  function desk(s,i){
    const {x,z}=s, start=scene.children.length;
    box(x,1.1,z,2.48,.16,1.18,0xb59879);
    for(const dx of [-.99,.99])box(x+dx,.55,z,.12,1.05,.89,frame);
    box(x,.78,z-.49,2.1,.55,.08,0x8a684e);
    cylinder(x-.85,1.22,z-.17,.16,.18,.05,0xa97839);
    cylinder(x-.85,1.55,z-.17,.028,.028,.62,0xac844b);
    cylinder(x-.85,1.87,z-.17,.07,.24,.18,0x9d8564);
    box(x,1.205,z-.22,.42,.04,.28,frame);box(x,1.32,z-.22,.1,.33,.11,frame);box(x,1.64,z-.25,.98,.61,.11,frame);
    box(x,1.65,z-.186,.86,.49,.02,[0x9bc2ba,0xb0cbd1,0xadc3ab][i%3]);
    box(x,1.2,z+.15,.68,.04,.23,0x536965);box(x+.72,1.2,z-.02,.4,.045,.47,porcelain);
    chair(x+.93,z+.99);
    const furniture=scene.children.slice(start);
    const station=new THREE.Group();station.position.set(x,0,z);
    furniture.forEach(o=>{o.position.x-=x;o.position.z-=z;o.userData.seat=i;station.add(o)});
    station.rotation.y=Math.PI;scene.add(station);
  }

  const parts=['body','head','opacity'],people=[],profiles=[];
  let selected=0, visitDesk=()=>{};
  function asset(name){return window.OFFICE_ASSETS?.[name]||'assets/'+name}
  function profileInfo(){
    const entry=profiles[selected]||{};
    document.getElementById('desk-number').textContent='Desk '+String(selected+1).padStart(2,'0');
    document.getElementById('desk-name').textContent=entry.name||'Employee '+(selected+1);
    document.getElementById('desk-role').textContent=entry.role||'Role unassigned';
    document.getElementById('desk-count').textContent=(selected+1)+' / '+seats.length;
    document.getElementById('standin').src=asset('employee-'+selected+'.webp');
    stage.classList.toggle('pending',!people[selected]);
  }
  async function loadPerson(seat,i){
    const response=await fetch(asset('person-'+i+'.bin'));
    if(!response.ok)throw Error('Model unavailable');
    const data=await response.arrayBuffer(), counts=new Uint32Array(data,0,3), packed=new Int16Array(data,12);
    const person=new THREE.Group();let offset=0;
    for(const [part,count] of counts.entries()){
      if(!count)continue;
      const geometry=new THREE.BufferGeometry(),pos=new Float32Array(count*3),uv=new Float32Array(count*2);
      for(let vertex=0;vertex<count;vertex++){
        for(let axis=0;axis<3;axis++)pos[3*vertex+axis]=packed[offset++]/10000;
        uv[2*vertex]=packed[offset++]/10000;uv[2*vertex+1]=packed[offset++]/10000;
      }
      geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
      const texture=await new THREE.TextureLoader().loadAsync(asset('person-'+i+'-'+parts[part]+'.webp'));
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,alphaTest:part===2?.4:0});
      const figure=new THREE.Mesh(geometry,mat);figure.userData.seat=i;figure.castShadow=true;person.add(figure);
    }
    person.position.set(seat.x,.08,seat.z-.91);person.rotation.y=.10*Math.sin(i*1.6);
    scene.add(person);people[i]=person;if(selected===i)profileInfo();redraw();
  }
  function office(){
    box(0,-.43,0,23.4,.75,15.7,0x506b60);box(0,-.03,0,23.25,.18,15.55,0xe1c8a4);
    for(let k=-7;k<=7;k++)box(0,.066,k,23.2,.012,.022,0xcba97d);
    for(let k=-7;k<=7;k++)for(let j=0;j<4;j++)box(-10+j*6+(Math.abs(k)%2)*2,.066,k+.5,.021,.012,.98,0xcba97d);
    box(0,.78,-7.65,23.3,1.46,.20,0xc4c6c0);box(-11.5,.65,0,.20,1.2,15.4,0xc4c6c0);
    for(let i=0;i<7;i++){const x=-9.85+i*3.24;box(x,2.51,-7.68,3.14,1.93,.1,0xacc5cc);box(x-1.60,2.51,-7.65,.08,2.10,.17,frame)}
    box(-.12,3.52,-7.64,22.9,.1,.19,frame);box(0,1.48,-7.62,23.2,.14,.29,frame);
    box(6.99,.09,-3.79,7.74,.06,6.6,0x72948c);
    box(7,.99,-3.78,3.92,.22,1.8,timber);for(const x of [5.8,8.2])box(x,.52,-3.78,.29,.9,1.03,frame);
    for(const x of [5.7,7,8.3]){chair(x,-2.27);chair(x,-5.3,-1)}
    box(7,1.14,-3.7,.78,.06,.56,porcelain);
    box(7,.094,3.77,7.76,.07,5.82,0xc69e78);
    box(7,.48,5.49,4.3,.82,1.28,0xc78054);box(7,1.03,6.03,4.3,.79,.28,0xd79862);
    for(const x of [5.02,8.98])box(x,.8,5.49,.32,.64,1.25,0xd79862);
    for(const x of [5.8,7,8.2])box(x,.9,5.44,1.14,.14,.9,0xe6ac7c);
    cylinder(7,.57,3.53,.95,.95,.13,porcelain);cylinder(7,.3,3.53,.33,.38,.48,frame);
    plant(9.9,1.6,1.1);plant(3.79,-6.4);plant(-10.12,6.23,1.2);plant(1.5,5.85,.95);
    // Glazed meeting-room partitions with an open entrance facing the aisle.
    const glass=new THREE.MeshPhysicalMaterial({color:0x96b9ad,transparent:true,opacity:.13,roughness:.08,depthWrite:false});
    for(const [x,z,w,d] of [[3.06,-4.5,.06,5.6],[7.9,-.47,5.8,.06]]){
      const pane=box(x,1.75,z,w,3.4,d,frame);pane.material=glass;pane.castShadow=false;
      box(x,3.45,z,Math.max(w,.07),.08,Math.max(d,.07),frame);
      for(const k of [-.5,0,.5])box(x+k*w,1.75,z+k*d,.07,3.4,.07,frame);
    }
    for(const x of [-7.5,-.4,6.9]){
      box(x,4.15,-3.9,3.45,.11,.16,0x3c423c);
      box(x,4.07,-3.9,3.38,.06,.14,0xffe6a2);
      for(const dx of [-1.3,1.3])cylinder(x+dx,4.48,-3.9,.018,.018,.65,frame);
    }
    for(let n=0;n<8;n++)box(10.9,.9,-6.8+n*.54,.24,1.6,.24,n%2?0x946d51:0x765742);
    seats.forEach(desk);
  }
  function init(pick){
    onPick=pick;stage.style.setProperty('--office-photo','url("'+asset('interior.webp')+'")');
    seats.forEach((s,i)=>{const b=document.createElement('button');b.className='pin';b.textContent=String(i+1);b.onclick=()=>{visitDesk(i);onPick(i)};labels.push(b);document.querySelector('#pins').append(b)});
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;holder.append(renderer.domElement);
      scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-16,16,12,-12,.1,150);
      deskCamera=new THREE.PerspectiveCamera(47,1,.07,90);
      scene.add(new THREE.HemisphereLight(0xfff8e8,0xb2c2af,2.45));const sun=new THREE.DirectionalLight(0xffead0,2.5);
      sun.position.set(-9,24,14);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-17,right:17,top:17,bottom:-17,far:60});sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.025;scene.add(sun);
      office();
      renderer.domElement.addEventListener('click',e=>{const r=holder.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera({x:2*(e.clientX-r.left)/r.width-1,y:1-2*(e.clientY-r.top)/r.height},view==='desk'?deskCamera:camera);const hit=ray.intersectObjects(scene.children,true)[0];if(hit && Number.isInteger(hit.object.userData.seat)){visitDesk(hit.object.userData.seat);onPick(hit.object.userData.seat)}});
      redraw=()=>{const w=holder.clientWidth,h=holder.clientHeight;if(!w||!h||view==='interior')return;renderer.setSize(w,h,false);
        if(view==='desk'){
          const s=seats[selected],dist=w/h<1.15?3.2:2.7;
          deskCamera.aspect=w/h;deskCamera.position.set(s.x+1.12,2.13,s.z-.91+dist);
          deskCamera.lookAt(s.x-.12,1.75,s.z-.91);deskCamera.updateProjectionMatrix();
          deskCamera.updateMatrixWorld();
          renderer.render(scene,deskCamera);
          seats.forEach(({x,z},i)=>{
            const v=new THREE.Vector3(x,2.69,z-.91).project(deskCamera), label=labels[i];
            const visible=Boolean(people[i])&&v.z>0&&v.z<1&&Math.abs(v.x)<.88&&v.y>-.6&&v.y<.96;
            label.style.visibility=visible?'visible':'hidden';
            label.style.left=(v.x+1)*50+'%';label.style.top=(1-v.y)*50+'%';
            label.classList.toggle('current-person',i===selected);
          });return;
        }
        const top=view==='top', span=Math.max((top?8.7:9.4),(top?12.7:14.8)*h/w)/zoom;
        const [cx,cy,cz]=centers[focus];
        Object.assign(camera,{left:-span*w/h,right:span*w/h,top:span,bottom:-span});
        camera.position.set(cx+(top?0:38*Math.sin(angle)),cy+(top?40:20),cz+(top?.001:38*Math.cos(angle)));camera.lookAt(cx,cy,cz);camera.updateProjectionMatrix();camera.updateMatrixWorld();
        renderer.render(scene,camera);seats.forEach(({x,z},i)=>{const v=new THREE.Vector3(x,top?2.6:2.8,z-.91).project(camera);labels[i].style.visibility='visible';labels[i].style.left=(v.x+1)*50+'%';labels[i].style.top=(1-v.y)*50+'%'})};
      const queue=seats.map((s,i)=>[s,i]);
      async function loadQueue(){while(queue.length){const [s,i]=queue.shift();try{await loadPerson(s,i)}catch(error){console.warn('Unable to load desk '+(i+1),error)}}}
      for(let worker=0;worker<3;worker++)loadQueue();
    }catch(error){
      stage.classList.add('fallback');
      labels.forEach((b,i)=>{b.style.left=(17+(i%4)*22)+'%';b.style.top=(23+Math.floor(i/4)*17)+'%'});
      ['smaller','larger','reset','rotate'].forEach(id=>document.getElementById(id).disabled=true);
    }
    const views={desk:'Desk view',interior:'Office interior',iso:'Work floor',top:'Floor plan'};
    const tabId=v=>({interior:'interior-tab',desk:'desk-tab'})[v]||v;
    function select(v,room='all'){
      view=v;focus=room;zoom=room==='all'?1:room==='team'?1.45:2.4;angle=.23;
      stage.classList.toggle('interior-mode',v==='interior');stage.classList.toggle('desk-mode',v==='desk');
      document.getElementById('view-title').textContent=({team:'Team floor',meeting:'Meeting room',lounge:'Lounge'})[room]||views[v];
      for(const key of Object.keys(views))document.getElementById(tabId(key)).setAttribute('aria-pressed',String(key===v));
      document.getElementById('rotate').disabled=v!=='iso'||stage.classList.contains('fallback');redraw();
    }
    visitDesk=i=>{selected=(i+seats.length)%seats.length;profileInfo();select('desk')};
    for(const v of Object.keys(views))document.getElementById(tabId(v)).onclick=()=>select(v);
    document.getElementById('previous').onclick=()=>visitDesk(selected-1);document.getElementById('next').onclick=()=>visitDesk(selected+1);
    document.getElementById('desk-profile').onclick=()=>onPick(selected);
    document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>select('iso',b.dataset.room));
    document.getElementById('rotate').onclick=()=>{angle+=Math.PI/6;redraw()};
    for(const [id,delta] of [['larger',.2],['smaller',-.2],['reset',0]])document.getElementById(id).onclick=()=>{if(!delta){select(view);return}zoom=Math.max(.7,Math.min(3,zoom+delta));redraw()};
    new ResizeObserver(()=>redraw()).observe(stage);visitDesk(0);
  }
  function label(i,name,role){profiles[i]={name,role};labels[i].dataset.caption=role?name+' · '+role:name;labels[i].title=name;labels[i].setAttribute('aria-label',name);if(i===selected)profileInfo()}
  return {init,label,asset,visit:i=>visitDesk(i)};
})();