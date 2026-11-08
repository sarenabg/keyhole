import crypto from 'node:crypto';
const A='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(buf){let n=BigInt('0x'+Buffer.from(buf).toString('hex')||'0');let s='';while(n>0n){s=A[Number(n%58n)]+s;n/=58n;}for(const b of buf){if(b===0)s='1'+s;else break;}return s;}
const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
const pub=publicKey.export({format:'der',type:'spki'}).subarray(-32);
const account=Buffer.from(pub).toString('hex');
const deadline=new Date(Date.now()+5*60e3).toISOString();
const message=JSON.stringify({signer_id:account,deadline,intents:[]});
const inner=Buffer.alloc(15);inner.writeBigInt64LE(BigInt(Date.now())*1000000n,0);crypto.randomBytes(7).copy(inner,8);
const nb=Buffer.alloc(32);Buffer.from([0x56,0x28,0xf6,0xc6]).copy(nb,0);nb[4]=0;Buffer.from('252812b3','hex').copy(nb,5);nb.writeBigUInt64LE(BigInt(Date.parse(deadline))*1000000n,9);inner.copy(nb,17);const nonce=nb;
const recipient=process.argv[2]||'intents.near';
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b};
const str=s=>{const b=Buffer.from(s,'utf8');return Buffer.concat([u32(b.length),b])};
const tag=u32((2**31+413)>>>0);
const body=Buffer.concat([str(message),nonce,str(recipient),Buffer.from([0])]);
const hash=crypto.createHash('sha256').update(Buffer.concat([tag,body])).digest();
const sig=crypto.sign(null,hash,privateKey);
const payloadStr=JSON.stringify({signer_id:account,verifying_contract:'intents.near',deadline,nonce:nonce.toString('base64'),intents:[]});
const rawSig=crypto.sign(null,Buffer.from(payloadStr),privateKey);
const signedData0={standard:'nep413',payload:{message,nonce:nonce.toString('base64'),recipient},public_key:'ed25519:'+b58(pub),signature:'ed25519:'+b58(sig)};
const r=await fetch('https://1click.chaindefuser.com/v0/auth/authenticate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({signedData: process.env.STD==='raw'?{standard:'raw_ed25519',payload:payloadStr,public_key:'ed25519:'+b58(pub),signature:'ed25519:'+b58(rawSig)}:signedData0})});
const t=await r.text();console.log('auth',r.status,JSON.stringify({...JSON.parse(t),accessToken:'..',refreshToken:'..'}));
if(!r.ok)process.exit();
const tok=JSON.parse(t).accessToken;
const dl=new Date(Date.now()+20*60e3).toISOString();
for(const conf of ['basic','advanced']){
const q={dry:true,swapType:'EXACT_INPUT',slippageTolerance:100,originAsset:'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',depositType:'ORIGIN_CHAIN',destinationAsset:'nep141:wrap.near',amount:'20000000',recipient:'example.near',recipientType:'DESTINATION_CHAIN',refundTo:'example.near',refundType:'ORIGIN_CHAIN',confidentiality:conf,deadline:dl};
const r2=await fetch('https://1click.chaindefuser.com/v0/quote',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+tok},body:JSON.stringify(q)});
console.log(conf,r2.status,(await r2.text()).slice(0,700));
}
const r3=await fetch('https://1click.chaindefuser.com/v0/account/balances',{headers:{authorization:'Bearer '+tok}});console.log('balances',r3.status,(await r3.text()).slice(0,300));
const r4=await fetch('https://1click.chaindefuser.com/v0/account/history',{headers:{authorization:'Bearer '+tok}});console.log('history',r4.status,(await r4.text()).slice(0,300));
