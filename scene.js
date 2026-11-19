/* All dimensions are in metres. The desk index is the stable employee id. */
const OfficeScene = (() => {
  const seats = [];
  [[-8.8,-5.6,-2.4,0.8],[-8.8,-5.6,-2.4],[-8.8,-5.6,-2.4,0.8],[-8.8,-5.6,-2.4]].forEach((row,r) =>
    row.forEach(x => seats.push({x,z:4.55-r*3.15})));
  let exploreCamera, orbit, deskCamera, camera, renderer, scene, view='iso', zoom=1, focus='all', redraw=()=>{}, onPick;
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
    chair(x,z+.99);
    const furniture=scene.children.slice(start);
    const station=new THREE.Group();station.position.set(x,0,z);
    furniture.forEach(o=>{o.position.x-=x;o.position.z-=z;o.userData.seat=i;station.add(o)});
    station.rotation.y=Math.PI;scene.add(station);
  }

  const furniturePick=[];
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
    const motionResponse=await fetch(asset('motion-'+i+'.bin'));
    if(!motionResponse.ok)throw Error('Animation unavailable');
    const motion=OfficeActivity.readMotion(await motionResponse.arrayBuffer(),counts[0]+counts[1]+counts[2]);
    const person=new THREE.Group();let offset=0;
    person.userData.labelHeight=2.7;
    for(const [part,count] of counts.entries()){
      if(!count)continue;
      const geometry=new THREE.BufferGeometry(),pos=new Float32Array(count*3),uv=new Float32Array(count*2);
      for(let vertex=0;vertex<count;vertex++){
        for(let axis=0;axis<3;axis++)pos[3*vertex+axis]=packed[offset++]/10000;
        uv[2*vertex]=packed[offset++]/10000;uv[2*vertex+1]=packed[offset++]/10000;
      }
      geometry.morphAttributes.position=motion(offset/5-count,count);
      geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
      const texture=await new THREE.TextureLoader().loadAsync(asset('person-'+i+'-'+parts[part]+'.webp'));
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,alphaTest:part===2?.4:0});
      const figure=new THREE.Mesh(geometry,mat);figure.userData.seat=i;person.add(figure);
    }
    const contact=new THREE.Mesh(new THREE.CircleGeometry(.38,16),contactMaterial);
    contact.rotation.x=-Math.PI/2;contact.position.y=.045;contact.scale.y=.76;
    person.add(contact);
    person.position.set(seat.x,.08,seat.z-.99);person.rotation.y=.10*Math.sin(i*1.6);
    scene.add(person);renderer.shadowMap.needsUpdate=true;people[i]=person;updateActivity(0);if(selected===i)profileInfo();redraw();
  }
  let contactMaterial;
  // Merge static furniture by material so moving fourteen characters needs few draw calls.
  // Keep the original meshes only for precise desktop and furniture hit testing.
  function batchFurniture(){
    scene.updateMatrixWorld(true);
    const groups=new Map(),objects=[];
    scene.traverse(object=>{
      if(!object.isMesh || object.material.transparent)return;
      objects.push(object);
      if(!groups.has(object.material))groups.set(object.material,{positions:[],normals:[],indices:[]});
      const batch=groups.get(object.material);
      const g=object.geometry.clone().applyMatrix4(object.matrixWorld);
      const first=batch.positions.length/3;
      batch.positions.push(...g.attributes.position.array);
      batch.normals.push(...g.attributes.normal.array);
      const n=g.index?g.index.count:g.attributes.position.count;
      for(let k=0;k<n;k++)batch.indices.push(first+(g.index?g.index.getX(k):k));
      g.dispose();
    });
    for(const object of objects){furniturePick.push(object);object.removeFromParent()}
    for(const [mat,batch] of groups){
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
      g.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));g.setIndex(batch.indices);
      const merged=new THREE.Mesh(g,mat);merged.castShadow=true;merged.receiveShadow=true;scene.add(merged);
    }
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
  const activityText=[];
  let seconds=6,cycle=-1,plans=[],paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function anchor(i,extra=0){
    const p=people[i],seat=seats[i];
    return new THREE.Vector3(p?.position.x??seat.x,(p?.userData.labelHeight??2.75)+extra,p?.position.z??(seat.z-.99));
  }
  function updateActivity(dt){
    const round=Math.floor(seconds/OfficeActivity.period);
    if(round!==cycle){plans=OfficeActivity.workday(seats,round);cycle=round}
    const totals={};
    for(let i=0;i<seats.length;i++){
      const p=people[i];if(!p)continue;
      const a=OfficeActivity.sample(seats[i],i,plans,seconds%OfficeActivity.period,profiles);
      totals[a.group]=(totals[a.group]||0)+1;
      const snap=!p.userData.pose;
      const blend=snap?1:1-Math.exp(-dt*9);
      const yawDelta=Math.atan2(Math.sin(a.yaw-p.rotation.y),Math.cos(a.yaw-p.rotation.y));
      p.rotation.y+=yawDelta*blend;
      p.position.set(a.x,.09+(a.pose==='walk'?.023*Math.abs(Math.sin(seconds*6.47+i*1.94)):0),a.z);
      const target=OfficeActivity.weights(a.pose,seconds,i);
      for(const mesh of p.children){
        const w=mesh.morphTargetInfluences;if(!w)continue;
        for(let k=0;k<w.length;k++)w[k]+=(target[k]-w[k])*(snap?1:1-Math.exp(-dt*18));
      }
      p.userData.pose=a.pose;
      const sit=a.pose==='work'||a.pose==='meeting';
      p.userData.labelHeight+=((sit?2.13:2.76)-p.userData.labelHeight)*blend;
      if(activityText[i]!==a.text){
        activityText[i]=a.text;labels[i].dataset.activity=a.group;labels[i].title=(profiles[i]?.name||'Employee')+' · '+a.text;
        const elem=document.getElementById('staff-activity-'+i);if(elem)elem.textContent=a.text;
      }
    }
    const summary=Object.entries(totals).map(([group,n])=>n+' '+group.toLowerCase()).join(' · ');
    const count=document.getElementById('activity-count');
    if(summary&&count.textContent!==summary)count.textContent=summary;
  }
  function startActivity(){
    const button=document.getElementById('motion-toggle');
    const sync=()=>{button.textContent=paused?'Resume':'Pause'};
    button.onclick=()=>{paused=!paused;sync()};sync();
    let last=0;
    function tick(now){
      requestAnimationFrame(tick);
      if(paused||document.hidden||view==='interior'){last=0;return}
      if(last&&now-last<46)return;
      const dt=last?Math.min((now-last)/1000,.25):0;last=now;
      seconds+=dt;updateActivity(dt);redraw();
    }
    requestAnimationFrame(tick);
  }
  function inspectSeat(i){
    if(view==='iso'){
      selected=i;
      profileInfo();
    }else{
      visitDesk(i);
    }
    onPick(i);
  }
  function frameRoom(room){
    const target=room==='all'?[-1.2,1.15,-.5]:centers[room];
    const distance=room==='all'?17:room==='team'?11:7;
    orbit.target.set(...target);
    exploreCamera.position.copy(orbit.target).add(new THREE.Vector3(.31,.38,1).multiplyScalar(distance));
    orbit.update();
  }
  function init(pick){
    onPick=pick;stage.style.setProperty('--office-photo','url("'+asset('interior.webp')+'")');
    seats.forEach((s,i)=>{const b=document.createElement('button');b.className='pin';b.textContent=String(i+1);b.onclick=()=>inspectSeat(i);labels.push(b);document.querySelector('#pins').append(b)});
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));
      renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;holder.append(renderer.domElement);
      scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-16,16,12,-12,.1,150);
      deskCamera=new THREE.PerspectiveCamera(47,1,.07,90);
      scene.add(new THREE.HemisphereLight(0xfff8e8,0xb2c2af,2.45));const sun=new THREE.DirectionalLight(0xffead0,2.5);
      sun.position.set(-9,24,14);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-17,right:17,top:17,bottom:-17,far:60});sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.025;scene.add(sun);
      office();batchFurniture();
      contactMaterial=new THREE.MeshBasicMaterial({color:0x463825,transparent:true,opacity:.21,depthWrite:false});
      const canvas=renderer.domElement;
      exploreCamera=new THREE.PerspectiveCamera(50,1,.08,100);
      orbit=new OfficeOrbitControls(exploreCamera,canvas);
      orbit.minDistance=1.4;
      orbit.maxDistance=34;
      orbit.minPolarAngle=.12;
      orbit.maxPolarAngle=Math.PI*.49;
      orbit.maxTargetRadius=15;
      orbit.rotateSpeed=.63;
      orbit.screenSpacePanning=false;
      orbit.zoomToCursor=true;
      let framePending=false;
      orbit.addEventListener('change',()=>{
        if(framePending)return;
        framePending=true;
        requestAnimationFrame(()=>{framePending=false;redraw()});
      });
      orbit.addEventListener('start',()=>stage.classList.add('navigating'));
      orbit.addEventListener('end',()=>stage.classList.remove('navigating'));
      // A click inspects a person. A drag or a two-finger gesture only moves the camera.
      let press=null;
      canvas.addEventListener('pointerdown',event=>{
        if(!event.isPrimary){press=null;return}
        press=event.button===0?{id:event.pointerId,x:event.clientX,y:event.clientY}:null;
      });
      canvas.addEventListener('pointermove',event=>{
        if(press && event.pointerId===press.id && Math.hypot(event.clientX-press.x,event.clientY-press.y)>4)press=null;
      });
      canvas.addEventListener('pointercancel',()=>{press=null});
      canvas.addEventListener('click',event=>{
        if(!press)return;
        press=null;
        const r=canvas.getBoundingClientRect();
        const ray=new THREE.Raycaster();
        const activeCamera=view==='iso'?exploreCamera:view==='desk'?deskCamera:camera;
        ray.setFromCamera({x:2*(event.clientX-r.left)/r.width-1,y:1-2*(event.clientY-r.top)/r.height},activeCamera);
        const hit=ray.intersectObjects([...furniturePick,...people.filter(Boolean)],true)[0];
        if(hit && Number.isInteger(hit.object.userData.seat))inspectSeat(hit.object.userData.seat);
      });
      let width=0,height=0;
      redraw=()=>{
        const w=holder.clientWidth,h=holder.clientHeight;
        if(!w||!h||view==='interior')return;
        if(w!==width||h!==height){
          width=w;height=h;renderer.setSize(w,h,false);
          exploreCamera.aspect=w/h;exploreCamera.updateProjectionMatrix();
        }
        if(view==='iso'){
          exploreCamera.updateMatrixWorld();
          renderer.render(scene,exploreCamera);
          seats.forEach(({x,z},i)=>{
            const point=anchor(i).project(exploreCamera);
            const label=labels[i];
            label.style.visibility=point.z>-1&&point.z<1&&Math.abs(point.x)<.97&&Math.abs(point.y)<.95?'visible':'hidden';
            label.style.left=(point.x+1)*50+'%';
            label.style.top=(1-point.y)*50+'%';
          });
          return;
        }
        if(view==='desk'){
          const s=anchor(selected),dist=w/h<1.15?3.2:2.7;
          deskCamera.aspect=w/h;deskCamera.position.set(s.x+1.12,s.y-.52,s.z+dist);
          deskCamera.lookAt(s.x-.12,s.y-.90,s.z);deskCamera.updateProjectionMatrix();
          deskCamera.updateMatrixWorld();
          renderer.render(scene,deskCamera);
          seats.forEach(({x,z},i)=>{
            const v=anchor(i).project(deskCamera), label=labels[i];
            const visible=Boolean(people[i])&&v.z>0&&v.z<1&&Math.abs(v.x)<.88&&v.y>-.6&&v.y<.96;
            label.style.visibility=visible?'visible':'hidden';
            label.style.left=(v.x+1)*50+'%';label.style.top=(1-v.y)*50+'%';
            label.classList.toggle('current-person',i===selected);
          });return;
        }
        const span=Math.max(8.7,12.7*h/w)/zoom;
        const [cx,cy,cz]=centers[focus];
        Object.assign(camera,{left:-span*w/h,right:span*w/h,top:span,bottom:-span});
        camera.position.set(cx,cy+40,cz+.001);camera.lookAt(cx,cy,cz);camera.updateProjectionMatrix();camera.updateMatrixWorld();
        renderer.render(scene,camera);seats.forEach(({x,z},i)=>{const v=anchor(i).project(camera);labels[i].style.visibility='visible';labels[i].style.left=(v.x+1)*50+'%';labels[i].style.top=(1-v.y)*50+'%'})};
      const queue=seats.map((s,i)=>[s,i]);
      async function loadQueue(){while(queue.length){const [s,i]=queue.shift();try{await loadPerson(s,i)}catch(error){console.warn('Unable to load desk '+(i+1),error)}}}
      for(let worker=0;worker<3;worker++)loadQueue();
    }catch(error){
      stage.classList.add('fallback');
      labels.forEach((b,i)=>{b.style.left=(17+(i%4)*22)+'%';b.style.top=(23+Math.floor(i/4)*17)+'%'});
      ['smaller','larger','reset','rotate'].forEach(id=>document.getElementById(id).disabled=true);
    }
    const views={desk:'Desk view',interior:'Office interior',iso:'Explore in 3D',top:'Floor plan'};
    const tabId=v=>({interior:'interior-tab',desk:'desk-tab'})[v]||v;
    function select(v,room='all',reframe=false){
      view=v;focus=room;zoom=room==='all'?1:room==='team'?1.45:2.4;
      if(orbit){orbit.enabled=v==='iso';if(orbit.enabled && reframe)frameRoom(room)}
      stage.classList.toggle('explore-mode',v==='iso');
      document.getElementById('navigation-help').hidden=v!=='iso'||stage.classList.contains('fallback');
      stage.classList.toggle('interior-mode',v==='interior');stage.classList.toggle('desk-mode',v==='desk');
      document.getElementById('view-title').textContent=({team:'Team floor',meeting:'Meeting room',lounge:'Lounge'})[room]||views[v];
      for(const key of Object.keys(views))document.getElementById(tabId(key)).setAttribute('aria-pressed',String(key===v));
      document.getElementById('rotate').disabled=v!=='iso'||stage.classList.contains('fallback');redraw();
    }
    visitDesk=i=>{selected=(i+seats.length)%seats.length;profileInfo();select('desk')};
    for(const v of Object.keys(views))document.getElementById(tabId(v)).onclick=()=>select(v);
    document.getElementById('previous').onclick=()=>visitDesk(selected-1);document.getElementById('next').onclick=()=>visitDesk(selected+1);
    document.getElementById('desk-profile').onclick=()=>onPick(selected);
    document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>select('iso',b.dataset.room,true));
    document.getElementById('rotate').onclick=()=>{exploreCamera.position.sub(orbit.target).applyAxisAngle(exploreCamera.up,Math.PI/6).add(orbit.target);orbit.update()};
    for(const [id,delta] of [['larger',.2],['smaller',-.2],['reset',0]])document.getElementById(id).onclick=()=>{if(!delta){select(view,'all',true);return}
      if(view==='iso' && orbit){
        const offset=exploreCamera.position.clone().sub(orbit.target);
        offset.setLength(THREE.MathUtils.clamp(offset.length()*(delta>0?.8:1.25),orbit.minDistance,orbit.maxDistance));
        exploreCamera.position.copy(orbit.target).add(offset);orbit.update();return;
      }
      zoom=Math.max(.7,Math.min(3,zoom+delta));redraw()};
    document.getElementById('meeting-camera').onclick=()=>select('iso','meeting',true);
    if(!stage.classList.contains('fallback'))startActivity();
    else document.getElementById('activity-bar').hidden=true;
    new ResizeObserver(()=>redraw()).observe(stage);profileInfo();select(stage.classList.contains('fallback')?'desk':'iso','all',true);
  }
  function label(i,name,role){profiles[i]={name,role};labels[i].dataset.caption=role && role!==name?name+' · '+role:name;labels[i].title=name;labels[i].setAttribute('aria-label',name);if(i===selected)profileInfo()}
  return {init,label,asset,activity:i=>activityText[i]||'',visit:i=>{if(view==='iso'){selected=i;profileInfo()}else{visitDesk(i)}}};
})();