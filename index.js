
const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json({ limit: '5mb' }));

const EVO_URL = process.env.EVO_URL || 'https://evolution-api-oida.onrender.com';
const EVO_KEY = process.env.EVO_KEY || 'CASA2026';
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'controle-casa';
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT || 'controle-casa-e140a';
const CASA_ID = 'CASA2026';

// DATAS FIXAS - valor muda todo mês, dia fixo
const VENC_FIXO = {
  'ALUGUEL': '05',
  'LUZ': '16',
  'GAS': '10',
  'SEGURO APTO': '17',
  'SEGURO CASA': '17',
  'INTERNET': '25',
  'CLARO': '25',
  'CARTAO': '09',
  'CARTAO CREDITO': '09',
  'CARRO': '11',
  'PRESTACAO CARRO': '11',
  'ESTACIONAMENTO': '09',
  'SEGURO CARRO': '05',
};

const FIXOS = [
  { keys: ['aluguel'], nome: 'ALUGUEL' },
  { keys: ['luz'], nome: 'LUZ' },
  { keys: ['gas'], nome: 'GAS' },
  { keys: ['internet','claro'], nome: 'INTERNET' },
  { keys: ['seguro apartamento','seguro apto','seguro casa'], nome: 'SEGURO APTO' },
  { keys: ['prestacao carro','prestação carro','parcela carro','carro'], nome: 'PRESTACAO CARRO' },
  { keys: ['seguro carro'], nome: 'SEGURO CARRO' },
  { keys: ['estacionamento'], nome: 'ESTACIONAMENTO' },
  { keys: ['cartao','cartão'], nome: 'CARTAO CREDITO' },
  { keys: ['combustivel','gnv','etanol','gasolina'], nome: 'COMBUSTIVEL' },
  { keys: ['mercado'], nome: 'MERCADO' },
  { keys: ['farmacia'], nome: 'FARMACIA' },
  { keys: ['almoco','almoço'], nome: 'ALMOCO FORA' },
  { keys: ['despesas extras','extra'], nome: 'DESPESAS EXTRAS' },
];

function anoAtual(){ return new Date().getFullYear(); }
function mesAtual(){ return (new Date().getMonth()+1).toString().padStart(2,'0'); }

function getDescricao(text){
  const lower = text.toLowerCase();
  for(const f of FIXOS){ if(f.keys.some(k=> lower.includes(k))) return f.nome; }
  return text.trim().split(/\s+/)[0].toUpperCase().substring(0,20);
}
function getValor(text){
  const m1 = text.match(/(\d+[.,]\d{2})/);
  if(m1) return parseFloat(m1[1].replace(',','.'));
  const m2 = text.match(/(\d+[.,]?\d*)/);
  if(m2) return parseFloat(m2[1].replace(',','.'));
  return 0;
}
function getVenc(text, descricao){
  // aceita 16/11, 16-11, 16/11/2026, 16/11/27
  const m = text.match(/venc(?:imento)?\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i);
  if(m){
    const dia = m[1].padStart(2,'0');
    const mes = m[2].padStart(2,'0');
    const ano = m[3] ? (m[3].length===2 ? '20'+m[3] : m[3]) : anoAtual();
    return `${dia}/${mes}/${ano}`;
  }
  // só dia: venc 16
  const m2 = text.match(/venc(?:imento)?\s*(\d{1,2})\b/i);
  if(m2){
    return `${m2[1].padStart(2,'0')}/${mesAtual()}/${anoAtual()}`;
  }
  // usa data fixa
  if(VENC_FIXO[descricao]){
    return `${VENC_FIXO[descricao]}/${mesAtual()}/${anoAtual()}`;
  }
  return `${new Date().getDate().toString().padStart(2,'0')}/${mesAtual()}/${anoAtual()}`;
}
function isPago(text){ return text.toLowerCase().includes('pago'); }
function getDataPag(text){
  const m = text.match(/pago\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i);
  if(m){
    const dia = m[1].padStart(2,'0');
    const mes = m[2].padStart(2,'0');
    const ano = m[3] ? (m[3].length===2 ? '20'+m[3] : m[3]) : anoAtual();
    return `${dia}/${mes}/${ano}`;
  }
  const m2 = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if(isPago(text) && m2){
    const dia = m2[1].padStart(2,'0');
    const mes = m2[2].padStart(2,'0');
    const ano = m2[3] ? (m2[3].length===2 ? '20'+m2[3] : m2[3]) : anoAtual();
    return `${dia}/${mes}/${ano}`;
  }
  if(isPago(text)) return new Date().toLocaleDateString('pt-BR');
  return '';
}

app.get('/', (req,res)=> res.send(`CASA2026 MULTI-ANOS OK - Ano ${anoAtual()} - Grátis`));
app.get('/health', (req,res)=> res.json({ok:true, casa:CASA_ID, ano:anoAtual(), vencFixos:VENC_FIXO}));

app.post('/webhook', async (req,res)=>{
  try{
    const body = req.body;
    const event = (body.event||'').toLowerCase();
    if(event !== 'messages.upsert' && event !== 'messages_upsert') return res.json({ok:true});
    let msgData = body.data;
    if(Array.isArray(msgData)) msgData = msgData[0];
    if(msgData?.messages) msgData = msgData.messages[0];
    if(!msgData) return res.json({ok:true});
    let text = msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || msgData.message?.imageMessage?.caption || '';
    if(!text || text.includes('salvo em CASA2026')) return res.json({ok:true});
    const remoteJid = msgData.key?.remoteJid || '';
    const descricao = getDescricao(text);
    const valor = getValor(text);
    const venc = getVenc(text, descricao);
    const pago = isPago(text);
    const dataPag = getDataPag(text);

    // Se for PAGO, atualiza último pendente
    if(pago){
      try{
        const listUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/gastos?pageSize=300`;
        const listRes = await fetch(listUrl);
        const listJson = await listRes.json();
        if(listJson.documents){
          const docs = listJson.documents.filter(d=> (d.fields?.descricao?.stringValue===descricao || d.fields?.categoria?.stringValue===descricao) && d.fields?.casa?.stringValue===CASA_ID && d.fields?.status?.stringValue!=='Pago').reverse();
          if(docs.length>0){
            const last = docs[0];
            const patch = { fields: { ...last.fields, status:{stringValue:'Pago'}, dataPagamento:{stringValue:dataPag}, valorPago:{doubleValue: valor||last.fields.valor?.doubleValue||0} } };
            await fetch(`https://firestore.googleapis.com/v1/${last.name}?updateMask.fieldPaths=status&updateMask.fieldPaths=dataPagamento&updateMask.fieldPaths=valorPago`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(patch)});
            const replyPago = `${descricao} marcado como PAGO em ${dataPag} - CASA2026!`;
            await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {method:'POST', headers:{'apikey':EVO_KEY,'Content-Type':'application/json'}, body:JSON.stringify({number: remoteJid, text: replyPago})});
            return res.json({ok:true, pago:true});
          }
        }
      }catch(e){ console.log('Erro pago', e.message); }
    }

    if(valor===0) return res.json({ok:true, skip:'sem valor'});

    const doc = {
      fields:{
        valor:{doubleValue:valor},
        valorPrevisto:{doubleValue:valor},
        descricao:{stringValue:descricao},
        categoria:{stringValue:descricao},
        vencimento:{stringValue:venc},
        dataVencimento:{stringValue:venc},
        ano:{integerValue: parseInt(venc.split('/')[2]||anoAtual())},
        mes:{integerValue: parseInt(venc.split('/')[1]||mesAtual())},
        casa:{stringValue:CASA_ID},
        origem:{stringValue:'whatsapp'},
        grupo:{stringValue:remoteJid},
        textoOriginal:{stringValue:text},
        status:{stringValue: pago? 'Pago':'Pendente'},
        criadoEm:{timestampValue:new Date().toISOString()}
      }
    };
    if(pago && dataPag) doc.fields.dataPagamento = {stringValue:dataPag};

    const fbUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/gastos`;
    await fetch(fbUrl, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(doc)});

    let reply = `${descricao} R$${valor.toFixed(2).replace('.',',')}`;
    if(venc) reply+= ` - venc ${venc}`;
    if(pago) reply+= ` - PAGO em ${dataPag}`;
    reply+= ` salvo em CASA2026!`;

    await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {method:'POST', headers:{apikey:EVO_KEY,'Content-Type':'application/json'}, body:JSON.stringify({number: remoteJid, text: reply})});
    res.json({ok:true, descricao, valor, venc, ano:anoAtual()});
  }catch(e){ console.error(e); res.status(500).json({ok:false, error:e.message}); }
});

app.get('/test', async (req,res)=>{
  const t = req.query.text||'Luz 303,75 vencimento 16/11';
  res.json({teste:t, parse:{descricao:getDescricao(t), valor:getValor(t), venc:getVenc(t,getDescricao(t)), pago:isPago(t), ano:anoAtual()}});
});

const PORT = process.env.PORT||3000;
app.listen(PORT, ()=> console.log('CASA2026 MULTI-ANOS na porta '+PORT+' ano '+anoAtual()));
