import express from 'express';
import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const app=express(); app.use(express.json({limit:'100kb'})); app.use(express.static('.'));
const PORT=process.env.PORT||3000;
const DB=process.env.DATA_FILE||'./data.json';
const defaults=[
{id:'raid',title:'레이드 티켓 충전',days:[0,1,2,3,4,5,6],time:'09:00',lead:0,enabled:true,detail:'레이드 티켓을 확인하세요'},
{id:'daily',title:'요귀 처치 일일 임무',days:[0,1,2,3,4,5,6],time:'09:10',lead:0,enabled:true,detail:'일일 금전 보상을 챙기세요'},
{id:'boss',title:'필드 보스',days:[0,1,2,3,4,5,6],time:'21:00',lead:10,enabled:true,detail:'필드 보스 참여 준비'},
{id:'guild',title:'요신 토벌령·결계지 방어',days:[3],time:'05:00',lead:0,enabled:true,detail:'문파 콘텐츠 초기화·정산 확인'},
{id:'fri',title:'신기 쟁탈전',days:[5],time:'20:00',lead:10,enabled:true,detail:'실제 경기 편성 시간 확인'},
{id:'sat',title:'미혹의 정원',days:[6],time:'20:00',lead:10,enabled:true,detail:'실제 경기 편성 시간 확인'},
{id:'frireg',title:'신기 쟁탈전 신청 확인',days:[5],time:'07:30',lead:0,enabled:true,detail:'신청 마감 시간은 게임에서 재확인'},
{id:'satreg',title:'미혹의 정원 신청 확인',days:[6],time:'07:30',lead:0,enabled:true,detail:'신청 마감 시간은 게임에서 재확인'},
{id:'weekly',title:'요귀 처치 주간 임무',days:[0],time:'09:20',lead:0,enabled:true,detail:'주간 금전 임무 진행 확인'},
{id:'season',title:'낙화의 전장 시즌 정산',days:[0],time:'12:00',lead:0,enabled:false,detail:'정확한 시즌 종료일 확인 후 켜세요'},
{id:'market',title:'거래소 판매 점검',days:[0,1,2,3,4,5,6],time:'19:00',lead:0,enabled:false,detail:'판매 가능한 아이템을 확인하세요'}
];
function read(){try{return JSON.parse(fs.readFileSync(DB,'utf8'))}catch{return {devices:{}}}}
function write(db){fs.mkdirSync(path.dirname(path.resolve(DB)),{recursive:true});fs.writeFileSync(DB+'.tmp',JSON.stringify(db,null,2));fs.renameSync(DB+'.tmp',DB)}
if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY){console.warn('VAPID keys missing. Generate: npx web-push generate-vapid-keys');}
else webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:admin@example.com',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
app.get('/health',(req,res)=>res.json({ok:true}));
app.get('/api/config',(req,res)=>res.json({publicKey:process.env.VAPID_PUBLIC_KEY||'',defaults}));
function validRules(rules){return Array.isArray(rules)&&rules.length<=30&&rules.every(r=>typeof r.id==='string'&&r.id.length<60&&typeof r.title==='string'&&r.title.length<=80&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)&&Array.isArray(r.days)&&r.days.every(d=>Number.isInteger(d)&&d>=0&&d<=6)&&Number.isInteger(r.lead)&&r.lead>=0&&r.lead<=120&&typeof r.enabled==='boolean'&&typeof r.detail==='string'&&r.detail.length<=150)}
app.post('/api/subscribe',(req,res)=>{const {subscription,rules,deviceId}=req.body||{};if(!subscription?.endpoint||!subscription?.keys?.p256dh||!subscription?.keys?.auth||!validRules(rules)||typeof deviceId!=='string'||deviceId.length>100)return res.status(400).json({error:'Invalid subscription or rules'});const db=read();db.devices[deviceId]={subscription,rules,lastSent:{}};write(db);res.json({ok:true})});
app.post('/api/rules',(req,res)=>{const {deviceId,rules}=req.body||{};if(typeof deviceId!=='string'||!validRules(rules))return res.status(400).json({error:'Invalid rules'});const db=read();if(!db.devices[deviceId])return res.status(404).json({error:'Subscribe first'});db.devices[deviceId].rules=rules;write(db);res.json({ok:true})});
app.post('/api/unsubscribe',(req,res)=>{const {deviceId}=req.body||{};const db=read();delete db.devices[deviceId];write(db);res.json({ok:true})});
app.post('/api/test',async(req,res)=>{const db=read(),device=db.devices[req.body?.deviceId];if(!device)return res.status(404).json({error:'Subscribe first'});try{await send(device.subscription,{title:'금전 알림 테스트',body:'푸시 알림이 정상적으로 연결되었습니다.'});res.json({ok:true})}catch(e){res.status(500).json({error:'Push failed',detail:String(e.message)})}});
async function send(sub,payload){if(!process.env.VAPID_PRIVATE_KEY)throw Error('VAPID not configured');return webpush.sendNotification(sub,JSON.stringify(payload))}
// Compute local Korean weekday and clock using Intl; evaluate each minute and deduplicate.
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function kstParts(date){const p=Object.fromEntries(fmt.formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));const day=new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay();return {date:`${p.year}-${p.month}-${p.day}`,day,hour:+p.hour,minute:+p.minute}}
function due(r,now){if(!r.enabled)return false;const p=kstParts(now);const [h,m]=r.time.split(':').map(Number);let target=h*60+m-r.lead;let day=p.day;while(target<0){target+=1440;day=(day+6)%7}return r.days.includes(day)&&p.hour*60+p.minute===target}
let checking=false;
async function tick(){if(checking)return;checking=true;try{const db=read(),now=new Date(),p=kstParts(now);let dirty=false;for(const [id,device] of Object.entries(db.devices)){for(const r of device.rules){if(!due(r,now))continue;const key=`${p.date}:${r.id}:${r.time}:${r.lead}`;if(device.lastSent[r.id]===key)continue;try{await send(device.subscription,{title:`💰 ${r.title}`,body:r.detail||'금전 콘텐츠를 확인하세요',tag:r.id});device.lastSent[r.id]=key;dirty=true}catch(e){console.error('Push failed:',id,e.statusCode||e.message);if(e.statusCode===404||e.statusCode===410){delete db.devices[id];dirty=true;break}}}if(device.lastSent){for(const [k,v] of Object.entries(device.lastSent))if(v.slice(0,10)<new Date(Date.now()-8*86400000).toISOString().slice(0,10)){delete device.lastSent[k];dirty=true}}}if(dirty)write(db)}finally{checking=false}}
setInterval(()=>tick().catch(console.error),15000);tick().catch(console.error);
app.listen(PORT,()=>console.log(`Gold push app on port ${PORT}`));
