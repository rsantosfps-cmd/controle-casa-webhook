
# CASA2026 MULTI-ANOS - 100% GRÁTIS - VÁRIOS ANOS

Sistema pra vários anos, não preso a 2026.

## Funciona assim (WhatsApp)
Grupo Contas casa / Casa 🏠:
- luz 187 → salva LUZ dia 16 (fixo) ano atual, valor variável 187
- Luz 303,75 vencimento 16/11 → usa data informada
- Luz 303,75 vencimento 16/11/2027 → já salva em 2027!
- luz pago 05/11 → marca última LUZ como paga em 05/11/ano atual
- pago luz 05/11/2026 → marca como pago

Datas fixas: ALUGUEL 05, LUZ 16, GAS 10, INTERNET 25, CARTAO 09, CARRO 11, etc. Valor sempre variável. Ano sempre dinâmico.

## Grátis
- Evolution API: Render Free
- Webhook: Render Free (este webhook/)
- Banco: Firebase controle-casa-e140a Free
- Site: Netlify Free (este frontend/)

## Deploy do Zero (já que apagou GitHub)

1. Crie novo repo no GitHub: casa2026 (Public)
2. Faça upload de webhook/index.js e webhook/package.json e frontend/index.html (arraste)
3. Render: New Web Service → conecte repo → Root Directory: webhook → Build: npm install → Start: npm start → Free → Env: EVO_URL=https://evolution-api-oida.onrender.com, EVO_KEY=CASA2026, EVO_INSTANCE=controle-casa, FIREBASE_PROJECT=controle-casa-e140a → Deploy → anote URL https://xxx.onrender.com
4. Evolution: POST https://evolution-api-oida.onrender.com/webhook/set/controle-casa com header apikey:CASA2026 body {"webhook":{"enabled":true,"url":"https://xxx.onrender.com/webhook","events":["MESSAGES_UPSERT"]}}
5. Netlify: Arraste frontend/index.html → Deploy → já fica Online CASA2026 multi-anos
6. UptimeRobot Free: ping a cada 5 min nas 2 URLs Render pra não dormir

## Firebase Rule (até 2027 pra usar vários anos)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2027, 12, 31);
    }
  }
}

## Teste
https://xxx.onrender.com/test?text=Luz%20303,75%20vencimento%2016/11/2027 → deve salvar em 2027

Pronto, funciona 2026,2027,2028...
