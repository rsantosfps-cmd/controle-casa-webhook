const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json({ limit: '2mb' }));

const EVO_URL = process.env.EVO_URL || 'https://evolution-api-oida.onrender.com';
const EVO_KEY = process.env.EVO_KEY || 'CASA2026';
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'controle-casa';
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT || 'controle-casa-e140a';
const CASA_ID = 'CASA2026';

const FIXOS = [
  { keys: ['aluguel'], nome: 'ALUGUEL' },
  { keys: ['luz'], nome: 'LUZ' },
  { keys: ['gas'], nome: 'GAS' },
  { keys: ['internet'], nome: 'INTERNET' },
  { keys: ['seguro apartamento','seguro apto'], nome: 'SEGURO APTO' },
  { keys: ['prestacao carro','prestação carro','parcela carro'], nome: 'PRESTACAO CARRO' },
  { keys: ['seguro carro'], nome: 'SEGURO CARRO' },
  { keys: ['estacionamento'], nome: 'ESTACIONAMENTO' },
  { keys: ['cartao','cartão'], nome: 'CARTAO CREDITO' },
  { keys: ['combustivel','gnv','etanol','gasolina'], nome: 'COMBUSTIVEL' },
  { keys: ['mercado'], nome: 'MERCADO' },
  { keys: ['farmacia'], nome: 'FARMACIA' },
  { keys: ['almoco','almoço'], nome: 'ALMOCO FORA' },
  { keys: ['despesas extras','extra'], nome: 'DESPESAS EXTRAS' },
];

function getDescricao(text){
  const lower = text.toLowerCase();
  for(const f of FIXOS){
    if(f.keys.some(k=> lower.includes(k))) return f.nome;
  }
  return text.split(' ')[0].toUpperCase();
}

app.get('/', (req,res)=> res.send('Controle Casa Webhook OK - CASA2026'));

app.post('/webhook', async (req,res)=>{
  try{
    const body = req.body;
    if(!body || body.event !== 'messages.upsert'){ return res.json({ok:true, skip:true}); }
    const msgData = body.data;
    if(!msgData) return res.json({ok:true});
    let text = msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || '';
    if(!text) return res.json({ok:true});
    if(text.includes('salvo em CASA2026')) return res.json({ok:true});
    const remoteJid = msgData.key.remoteJid;
    const descricao = getDescricao(text);
    let valor = 0;
    const mv = text.match(/(\d+[.,]\d{2})/);
    if(mv) valor = parseFloat(mv[1].replace(',', '.'));
    else {
      const mf = text.match(/(\d+[.,]?\d*)/);
      if(mf) valor = parseFloat(mf[1].replace(',', '.'));
    }
    if(valor===0) return res.json({ok:true, noValor:true});
    let venc='';
    const vencM = text.match(/venc(?:imento)?\s*(\d{1,2})[\/\-](\d{1,2})/i);
    if(vencM) venc = vencM[1].padStart(2,'0') + '/' + vencM[2].padStart(2,'0');
    const doc = {
      fields:{
        valor:{doubleValue:valor},
        descricao:{stringValue:descricao},
        categoria:{stringValue:descricao},
        vencimento:{stringValue:venc},
        casa:{stringValue:CASA_ID},
        origem:{stringValue:'whatsapp'},
        grupo:{stringValue:remoteJid},
        textoOriginal:{stringValue:text},
        criadoEm:{timestampValue:new Date().toISOString()}
      }
    };
    const fbUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/gastos`;
    await fetch(fbUrl, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(doc)});
    let reply = descricao + ' R$' + valor.toFixed(2).replace('.',',');
    if(venc) reply += ' - venc ' + venc;
    reply += ' salvo em CASA2026!';
    await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method:'POST',
      headers:{'apikey':EVO_KEY, 'Content-Type':'application/json'},
      body:JSON.stringify({number: remoteJid, text: reply})
    });
    res.json({ok:true, descricao, valor});
  }catch(e){
    console.error(e);
    res.status(500).json({ok:false, error:e.message});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Webhook CASA2026 na porta '+PORT));
