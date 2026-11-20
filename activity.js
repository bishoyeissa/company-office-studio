// Private rehearsal of a working day. Time is measured in simulated seconds.
const OfficeActivity = (() => {
  const period=76, speed=1.85;
  const tasks={
    'Office Manager':'Coordinating handoffs',
    'Brand & Marketing Strategist':'Reviewing brand strategy',
    'Content & Creative Strategist':'Preparing a creative brief',
    Copywriter:'Writing campaign copy',
    'Graphic Designer':'Designing campaign assets',
    'Video Editor':'Editing a reel',
    'Paid Media Specialist':'Reviewing campaign tests',
    'Performance & Sales Analyst':'Analyzing orders and spend',
    'Creative QA Reviewer':'Checking final exports',
    'CRM & Sales Conversation Analyst':'Reviewing sales objections',
    'Brand Asset Coordinator':'Organizing approved assets',
    'AI Enablement Specialist':'Testing a role-specific skill',
    'Social Media & Community Manager':'Preparing the publishing calendar',
    'Email Monitoring & Reporting Specialist':'Preparing the email summary'
  };
  function home(seat){return [seat.x,seat.z-.99]}
  function aisle(seat){return [seat.x+.78,seat.z-1.82]}
  function exitDesk(seat){return [home(seat),[seat.x+.78,seat.z-.99],aisle(seat)]}
  function itinerary(points){
    let length=0;
    const legs=[];
    for(let j=1;j<points.length;j++){
      const [x,z]=points[j-1],dx=points[j][0]-x,dz=points[j][1]-z;
      const distance=Math.hypot(dx,dz);
      if(distance<.01)continue;
      legs.push({x,z,dx,dz,distance,start:length});length+=distance;
    }
    return {legs,length};
  }
  function workday(seats,round){
    const plans=seats.map(()=>null);
    const next=i=>(i+round*3)%seats.length;
    [1,6,7].forEach((index,chair)=>{
      const id=next(index),seat=seats[id],exit=exitDesk(seat),chairX=[7,5.7,8.3][chair];
      const lane=2.48+chair*.12;
      const farSide=chair===0;
      const approachZ=farSide?-6.12:-1.46;
      const end=[chairX,farSide?-5.3:-2.27];
      const points=[...exit,[lane,aisle(seat)[1]],[lane,.48],[4.28,.48],[4.28,approachZ],[chairX,approachZ],end];
      plans[id]={kind:'meeting',leave:1+chair*1.7,back:38+chair*2,points,end,yaw:farSide?0:Math.PI};
    });
    [[0,4,0,29],[2,3,5,34]].forEach(([a,b,leave,back])=>{
      const id=next(a),host=next(b),from=seats[id],to=seats[host],end=[to.x+.77,to.z-1.39];
      const route=exitDesk(from);
      // Use the side aisle when desks are on different rows.
      if(from.z!==to.z)route.push([2.5,aisle(from)[1]],[2.5,aisle(to)[1]]);
      route.push(aisle(to),end);
      plans[id]={kind:'visit',host,leave,back,points:route,end,yaw:Math.atan2(-.77,.4)};
    });
    for(const plan of plans){
      if(!plan)continue;
      plan.out=itinerary(plan.points);plan.in=itinerary([...plan.points].reverse());
      plan.arrive=plan.leave+plan.out.length/speed;
    }
    return plans;
  }
  function travel(route,seconds){
    const distance=Math.min(route.length,Math.max(0,seconds*speed));
    const leg=route.legs.find(l=>distance<=l.start+l.distance)||route.legs.at(-1);
    const f=Math.min(1,(distance-leg.start)/leg.distance);
    return {x:leg.x+leg.dx*f,z:leg.z+leg.dz*f,yaw:Math.atan2(leg.dx,leg.dz)};
  }
  function sample(seat,i,plans,t,profiles){
    const plan=plans[i],name=j=>profiles[j]?.name||'Employee '+(j+1);
    const result={x:seat.x,z:seat.z-.99,yaw:0,pose:'work',group:'At desks',text:tasks[profiles[i]?.role]||'Working on a task'};
    if(plan&&t>=plan.leave && t<plan.back+plan.in.length/speed){
      const meeting=plan.kind==='meeting';
      if(t<plan.arrive || t>=plan.back){
        const returning=t>=plan.back;
        Object.assign(result,travel(returning?plan.in:plan.out,t-(returning?plan.back:plan.leave)));
        result.pose='walk';result.group='Walking';
        result.text=returning?'Returning to desk':meeting?'Walking to meeting':'Visiting '+name(plan.host);
      }else{
        [result.x,result.z]=plan.end;result.yaw=plan.yaw;
        result.pose=meeting?'meeting':'talk';result.group=meeting?'In meeting':'Collaborating';
        result.text=meeting?'In team meeting':'Briefing '+name(plan.host);
      }
    }else{
      const guest=plans.findIndex(p=>p?.kind==='visit'&&p.host===i&&t>=p.arrive&&t<p.back);
      if(guest>=0){result.pose='meeting';result.group='Collaborating';result.text='Reviewing with '+name(guest);result.yaw=.48}
    }
    return result;
  }
  // Signed 16-bit absolute pose coordinates, indexed across duplicate FBX vertices.
  function readMotion(buffer,vertexCount){
    const count=new DataView(buffer).getUint32(0,true);
    const indices=new Uint16Array(buffer,4,vertexCount);
    const poses=new Int16Array(buffer,4+2*vertexCount);
    if(poses.length!==7*count*3)throw Error('Invalid motion data');
    return (start,length)=>{
      const targets=[];
      for(let pose=0;pose<7;pose++){
        const data=new Float32Array(length*3);
        for(let j=0;j<length;j++){
          const source=3*(pose*count+indices[start+j]);
          for(let axis=0;axis<3;axis++)data[j*3+axis]=poses[source+axis]/6000;
        }
        targets.push(new THREE.BufferAttribute(data,3));
      }
      return targets;
    };
  }
  function weights(pose,time,i){
    const w=[0,0,0,0,0,0,0];
    const phase=time*1.03+i*.31;
    if(pose==='walk'){
      const stride=(phase%1)*4,k=Math.floor(stride);
      w[k]=1-(stride-k);w[(k+1)%4]=stride-k;
    }else if(pose==='talk'){
      w[6]=.68+.3*Math.sin(time*2+i);
    }else{
      const gesture=pose==='meeting'?.48+.40*Math.sin(time*1.8+i):.10+.075*Math.sin(time*4+i);
      w[4]=1-gesture;w[5]=gesture;
    }
    return w;
  }
  return {period,workday,sample,readMotion,weights};
})();
