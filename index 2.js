
const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json({ limit: '5mb' }));

const EVO_URL = process.env.EVO_URL || 'https://evolution-api-oida.onrender.com';
const EVO_KEY = process.env.EVO_KEY || 'CASA2026';
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'controle-casa';
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT || 'controle-casa-e140a';
const CASA_ID = 'CASA2026';

const VENC_FIXO = {'ALUGUEL':'05','LUZ':'16','GAS':'10','SEGURO APTO':'17','INTERNET':'25','CARTAO':'09','CARTAO CREDITO':'09','CARRO':'11','PRESTACAO CARRO':'11','ESTACIONAMENTO':'09','SEGURO CARRO':'05'};
const FIXOS = [{keys:['aluguel'],nome:'ALUGUEL'},{keys:['luz'],nome:'LUZ'},{keys:['gas'],nome:'GAS'},{keys:['internet','claro'],nome:'INTERNET'},{keys:['seguro apartamento','seguro apto','seguro casa'],nome:'SEGURO APTO'},{keys:['prestacao carro','prestação carro','parcela carro','carro'],nome:'PRESTACAO CARRO'},{keys:['seguro carro'],nome:'SEGURO CARRO'},{keys:['estacionamento'],nome:'ESTACIONAMENTO'},{keys:['cartao','cartão'],nome:'CARTAO CREDITO'},{keys:['combustivel','gnv','etanol','gasolina'],nome:'COMBUSTIVEL'},{keys:['mercado'],nome:'MERCADO'},{keys:['farmacia'],nome:'FARMACIA'},{keys:['almoco','almoço'],nome:'ALMOCO FORA'}];

function anoAtual(){return new Date().getFullYear();} function mesAtual(){return (new Date().getMonth()+1).toString().padStart(2,'0');}
function getDescricao(t){const l=t.toLowerCase(); for(const f of FIXOS){if(f.keys.some(k=>l.includes(k)))return f.nome;} return t.trim().split(/\s+/)[0].toUpperCase().substring(0,20);}
function getValor(t){const m1=t.match(/(\d+[.,]\d{2})/); if(m1) return parseFloat(m1[1].replace(',','.')); const m2=t.match(/(\d+[.,]?\d*)/); if(m2) return parseFloat(m2[1].replace(',','.')); return 0;}
function getVenc(t,d){const m=t.match(/venc(?:imento)?\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i); if(m){const dia=m[1].padStart(2,'0'); const mes=m[2].padStart(2,'0'); const ano=m[3]? (m[3].length===2?'20'+m[3]:m[3]):anoAtual(); return `${dia}/${mes}/${ano}`;} const m2=t.match(/venc(?:imento)?\s*(\d{1,2})\b/i); if(m2) return `${m2[1].padStart(2,'0')}/${mesAtual()}/${anoAtual()}`; if(VENC_FIXO[d]) return `${VENC_FIXO[d]}/${mesAtual()}/${anoAtual()}`; return `${new Date().getDate().toString().padStart(2,'0')}/${mesAtual()}/${anoAtual()}`;}
function isPago(t){return t.toLowerCase().includes('pago');}
function getDataPag(t){const m=t.match(/pago\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i); if(m){const dia=m[1].padStart(2,'0'); const mes=m[2].padStart(2,'0'); const ano=m[3]? (m[3].length===2?'20'+m[3]:m[3]):anoAtual(); return `${dia}/${mes}/${ano}`;} if(isPago(t)) return new Date().toLocaleDateString('pt-BR'); return '';}

let lastLogs = [];
function addLog(m){lastLogs.unshift(new Date().toISOString()+' - '+m); if(lastLogs.length>50) lastLogs.pop(); console.log(m);}

app.get('/', (req,res)=> res.send(`CASA2026 MULTI-ANOS OK - Ano ${anoAtual()} - Live ${new Date().toISOString()}`));
app.get('/logs', (req,res)=> res.json({logs:lastLogs, count:lastLogs.length}));
app.get('/test', (req,res)=>{const t=req.query.text||'Luz 303,75 vencimento 16/11/2026'; res.json({teste:t, parse:{descricao:getDescricao(t), valor:getValor(t), venc:getVenc(t,getDescricao(t)), pago:isPago(t), ano:anoAtual()}});});
app.get('/test-save', async (req,res)=>{
  const t=req.query.text||'Luz 303,75 vencimento 16/11/2026';
  const desc=getDescricao(t); const valor=getValor(t); const venc=getVenc(t,desc);
  const doc={fields:{valor:{doubleValue:valor}, valorPrevisto:{doubleValue:valor}, descricao:{stringValue:desc}, categoria:{stringValue:desc}, vencimento:{stringValue:venc}, dataVencimento:{stringValue:venc}, ano:{integerValue:parseInt(venc.split('/')[2]||anoAtual())}, mes:{integerValue:parseInt(venc.split('/')[1]||mesAtual())}, casa:{stringValue:CASA_ID}, origem:{stringValue:'teste-save'}, textoOriginal:{stringValue:t}, status:{stringValue:'Pendente'}, criadoEm:{timestampValue:new Date().toISOString()}}};
  try{
    const fbUrl=`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/gastos`;
    const fbRes=await fetch(fbUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(doc)});
    const fbText=await fbRes.text();
    addLog(`TEST-SAVE ${desc} ${valor} ${venc} status ${fbRes.status}`);
    res.json({ok:fbRes.status<300, parse:{desc,valor,venc}, firebaseStatus:fbRes.status, firebase:fbText.substring(0,500)});
  }catch(e){addLog('TEST-SAVE ERRO '+e.message); res.status(500).json({ok:false, error:e.message});}
});

app.post('/webhook', async (req,res)=>{
  try{
    addLog('WEBHOOK CHEGOU');
    addLog(JSON.stringify(req.body).substring(0,800));
    const body=req.body; const event=(body.event||'').toLowerCase();
    if(event!=='messages.upsert' && event!=='messages_upsert'){addLog('Evento ignorado '+body.event); return res.json({ok:true});}
    let msgData=body.data; if(Array.isArray(msgData)) msgData=msgData[0]; if(msgData?.messages) msgData=msgData.messages[0];
    if(!msgData){addLog('Sem msgData'); return res.json({ok:true});}
    let text=msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || msgData.message?.imageMessage?.caption || '';
    if(!text){addLog('Sem texto'); return res.json({ok:true});}
    if(text.includes('salvo em CASA2026')){addLog('Loop ignorado'); return res.json({ok:true});}
    const remoteJid=msgData.key?.remoteJid||'';
    const descricao=getDescricao(text); const valor=getValor(text); const venc=getVenc(text,descricao); const pago=isPago(text); const dataPag=getDataPag(text);
    addLog(`PARSE ${descricao} ${valor} ${venc} pago=${pago} jid=${remoteJid} texto=${text}`);

    if(pago){
      try{
        const listUrl=`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/gastos?pageSize=300`;
        const listRes=await fetch(listUrl); const listJson=await listRes.json();
        if(listJson.documents){
          const docs=listJson.documents.filter(d=> (d.fields?.descricao?.stringValue===descricao) && d.fields?.casa?.stringValue===CASA_ID && d.fields?.status?.stringValue!=='Pago').reverse();
          if(docs.length>0){
            const last=docs[0];
            const patch={fields:{...last.fields, status:{stringValue:'Pago'}, dataPagamento:{stringValue:dataPag}, valorPago:{doubleValue:valor||last.fields.valor?.doubleValue||0}}};
            await fetch(`https://firestore.googleapis.com/v1/${last.name}?updateMask.fieldPaths=status&updateMask.fieldPaths=dataPagamento&updateMask.fieldPaths=valorPago`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});
            const replyPago=`${descricao} marcado como PAGO em ${dataPag} - CASA2026!`;
            await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`,{method:'POST',headers:{'apikey':EVO_KEY,'Content-Type':'application/json'},body:JSON.stringify({number:remoteJid,text:replyPago})});
            addLog(`PAGO ${descricao} ${dataPag}`);
            return res.json({ok:true, pago:true});
          }
        }
      }catch(e){addLog('Erro pago '+e.message);}
    }

    if(valor===0){addLog('Valor zero'); return res.json({ok:true});}

    const doc={fields:{valor:{doubleValue:valor}, valorPrevisto:{doubleValue:valor}, descricao:{stringValue:descricao}, categoria:{stringValue:descricao}, vencimento:{stringValue:venc}, dataVencimento:{stringValue:venc}, ano:{integerValue:parseInt(venc.split('/')[2]||anoAtual())}, mes:{integerValue:parseInt(venc.split('/')[1]||mesAtual())}, casa:{stringValue:CASA_ID}, origem:{stringValue:'whatsapp'}, grupo:{stringValue:remoteJid}, textoOriginal:{stringValue:text}, status:{stringValue:pago?'Pago':'Pendente'}, criadoEm:{timestampValue:new Date().toISOString()}}};
    if(pago&&dataPag) doc.fields.dataPagamento={stringValue:dataPag};

    const fbUrl=`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/gastos`;
    const fbRes=await fetch(fbUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(doc)});
    const fbText=await fbRes.text();
    addLog(`Firebase ${fbRes.status} ${fbText.substring(0,300)}`);

    let reply=`${descricao} R$${valor.toFixed(2).replace('.',',')}`; if(venc) reply+=` - venc ${venc}`; if(pago) reply+=` - PAGO em ${dataPag}`; reply+=` salvo em CASA2026!`;
    const evoRes=await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`,{method:'POST',headers:{apikey:EVO_KEY,'Content-Type':'application/json'},body:JSON.stringify({number:remoteJid,text:reply})});
    const evoText=await evoRes.text();
    addLog(`Evolution ${evoRes.status} ${evoText.substring(0,300)}`);
    res.json({ok:true, descricao, valor, venc});
  }catch(e){addLog('ERRO GERAL '+e.message); console.error(e); res.status(500).json({ok:false, error:e.message});}
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=> console.log('CASA2026 MULTI-ANOS na porta '+PORT+' ano '+anoAtual()));
