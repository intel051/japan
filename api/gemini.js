import { TRAVEL_SYSTEM_PROMPT, prepareInput } from '../lib/travel-prompt.js';
export const config = { maxDuration: 60 };
function send(res,status,data){return res.status(status).json(data)}
function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null}catch{return null}}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{error:'POST 요청만 지원합니다.'})}
  const origin=req.headers?.origin,host=req.headers?.host;
  if(origin&&host){try{if(new URL(origin).host!==host)return send(res,403,{error:'이 사이트에서 다시 요청해 주세요.'})}catch{return send(res,403,{error:'요청 주소를 확인해 주세요.'})}}
  let body=req.body;
  try{if(typeof body==='string')body=JSON.parse(body);if(JSON.stringify(body??{}).length>65536)return send(res,413,{error:'질문과 일정 내용이 너무 길어요. 조금 줄여 주세요.'})}catch{return send(res,400,{error:'올바른 질문 형식이 아닙니다.'})}
  let input;
  try{input=prepareInput(body)}catch(e){return send(res,400,{error:e.message})}
  const apiKey=process.env.GEMINI_API_KEY?.trim();
  if(!apiKey)return send(res,503,{error:'AI 연결 설정이 필요합니다. Vercel의 GEMINI_API_KEY를 설정한 뒤 다시 배포해 주세요.',code:'MISSING_API_KEY'});
  const model=process.env.GEMINI_MODEL||'gemini-3.5-flash-lite';
  if(!/^[a-zA-Z0-9._-]+$/.test(model))return send(res,503,{error:'서버의 Gemini 모델 설정을 확인해 주세요.'});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
  try{
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},signal:controller.signal,body:JSON.stringify({systemInstruction:{parts:[{text:TRAVEL_SYSTEM_PROMPT}]},contents:input.contents,generationConfig:{maxOutputTokens:5000,thinkingConfig:{thinkingLevel:'minimal'}},...(input.useSearch?{tools:[{google_search:{}}]}:{})})});
    let data;try{data=await response.json()}catch{return send(res,502,{error:'AI 서버가 올바른 응답을 보내지 않았어요. 잠시 후 다시 시도해 주세요.'})}
    if(!response.ok){const status=response.status;console.error('travel_ai_upstream',{status,code:data.error?.status});
      if(status===429)return send(res,429,{error:'Gemini 사용량 한도에 도달했어요. 잠시 후 재시도하거나 API 할당량을 확인해 주세요.',code:'RATE_LIMITED'});
      if(status===401||status===403)return send(res,503,{error:'Gemini API 키 또는 모델 접근 권한을 확인해 주세요.',code:'API_PERMISSION'});
      if(status===404)return send(res,503,{error:`설정된 Gemini 모델(${model})을 사용할 수 없어요. 모델 이름과 사용 권한을 확인해 주세요.`,code:'MODEL_UNAVAILABLE'});
      return send(res,status>=500?502:400,{error:'AI 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',code:'UPSTREAM_ERROR'});
    }
    const candidate=data.candidates?.[0];
    const answer=(candidate?.content?.parts??[]).filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('\n').trim();
    if(!answer)return send(res,502,{error:data.promptFeedback?.blockReason||candidate?.finishReason==='SAFETY'?'이 질문에는 답변을 생성하지 못했어요. 여행에 관한 질문으로 바꿔 주세요.':'답변이 비어 있어요. 질문을 조금 바꿔 다시 요청해 주세요.'});
    const grounding=candidate?.groundingMetadata;const sources=[];const seen=new Set();
    for(const chunk of grounding?.groundingChunks??[]){const url=safeURL(chunk.web?.uri);if(url&&!seen.has(url)){seen.add(url);sources.push({title:String(chunk.web?.title||'참고 자료').slice(0,180),url});}}
    return send(res,200,{text:answer,sources:sources.slice(0,20),searchSuggestions:typeof grounding?.searchEntryPoint?.renderedContent==='string'?grounding.searchEntryPoint.renderedContent.slice(0,60000):'',searchUsed:!!grounding?.webSearchQueries?.length,model,truncated:candidate?.finishReason==='MAX_TOKENS'});
  }catch(e){if(e.name==='AbortError')return send(res,504,{error:'답변 생성 시간이 길어졌어요. 질문을 나누거나 검색을 끄고 다시 시도해 주세요.',code:'TIMEOUT'});console.error('travel_ai_request_failed',{name:e.name});return send(res,502,{error:'AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'})}finally{clearTimeout(timeout)}
}
