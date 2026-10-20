const form = document.querySelector('#travel-ai-form');
const questionInput = document.querySelector('#travel-ai-question');
const log = document.querySelector('#travel-ai-log');
const notice = document.querySelector('#travel-ai-notice');
const submitButton = document.querySelector('#travel-ai-submit');
const cancelButton = document.querySelector('#travel-ai-cancel');
const includeTrip = document.querySelector('#travel-ai-include-trip');
const tripSelect = document.querySelector('#travel-ai-trip');
const searchToggle = document.querySelector('#travel-ai-search');
const storageKey = 'tripnote-html-v1';
let history = [];
let controller = null;
let requestNumber = 0;
let trips = [];
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function safeURL(url) { try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; } }
function inline(node, value) {
  const regex = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let start = 0, match;
  while ((match = regex.exec(value))) {
    node.append(document.createTextNode(value.slice(start, match.index)));
    if (match[1]) node.append(element('strong', '', match[1]));
    else { const url = safeURL(match[3]); if (url) { const link = element('a', '', match[2]); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; node.append(link); } else node.append(document.createTextNode(match[0])); }
    start = regex.lastIndex;
  }
  node.append(document.createTextNode(value.slice(start)));
}
function renderAnswer(text) {
  const fragment = document.createDocumentFragment();
  let list = null;
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) { list = null; continue; }
    const heading = trimmed.match(/^#{1,4}\s+(.+)/);
    const bullet = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.+)/);
    if (heading) { list = null; const node = element('h4'); inline(node, heading[1]); fragment.append(node); }
    else if (bullet) { if (!list) { list = element('ul'); fragment.append(list); } const node = element('li'); inline(node, bullet[1]); list.append(node); }
    else { list = null; const node = element('p'); inline(node, trimmed); fragment.append(node); }
  }
  return fragment;
}
function showNotice(message, error = false) { notice.textContent = message; notice.dataset.error = String(error); }
function loadTrips() {
  const previous = tripSelect.value;
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '[]'); trips = Array.isArray(value) ? value.filter(t => t && typeof t.id === 'string' && typeof t.title === 'string' && Array.isArray(t.activities)).slice(0, 100) : []; } catch { trips = []; }
  tripSelect.replaceChildren();
  if (!trips.length) { const option = element('option', '', '먼저 여행을 저장해 주세요'); option.value = ''; tripSelect.append(option); }
  for (const trip of trips) { const option = element('option', '', `${trip.title.slice(0, 100)} · ${String(trip.city || '').slice(0, 80)}`); option.value = trip.id; tripSelect.append(option); }
  if (trips.some(t => t.id === previous)) tripSelect.value = previous;
  tripSelect.disabled = !trips.length || !includeTrip.checked;
  document.querySelector('#travel-ai-trip-note').textContent = trips.length ? '선택한 여행의 날짜·일정·예산을 함께 참고해요. 최신 변경사항은 먼저 여행 저장을 눌러 주세요.' : '저장한 여행이 없어도 질문만으로 상담할 수 있어요.';
}
function setBusy(busy) {
  submitButton.disabled = busy;
  submitButton.textContent = busy ? '답변을 만들고 있어요' : 'AI에게 물어보기';
  cancelButton.hidden = !busy;
  form.setAttribute('aria-busy', String(busy));
}
function pendingAnswer(question) {
  const item = element('article', 'travel-ai-turn');
  const asked = element('div', 'travel-ai-user'); asked.append(element('span', 'travel-ai-role', '나의 질문'), element('p', '', question));
  const answer = element('div', 'travel-ai-answer'); answer.append(element('span', 'travel-ai-role', 'TRIPNOTE AI'));
  const waiting = element('div', 'travel-ai-waiting'); waiting.setAttribute('role', 'status'); waiting.append(element('span', '', '여행 아이디어를 정리하고 있어요'));
  const dots = element('span', 'travel-ai-dots'); dots.setAttribute('aria-hidden', 'true'); dots.append(element('i'), element('i'), element('i')); waiting.append(dots); answer.append(waiting); item.append(asked, answer); log.append(item);
  return { item, answer, waiting };
}
function finishAnswer(node, data) {
  node.waiting.remove();
  const content = element('div', 'travel-ai-content'); content.append(renderAnswer(data.text)); node.answer.append(content);
  if (Array.isArray(data.sources) && data.sources.length) {
    const sourceArea = element('div', 'travel-ai-sources'); sourceArea.append(element('h5', '', '참고한 출처'));
    data.sources.forEach((source, index) => { const url = safeURL(source.url); if (!url) return; const a = element('a', '', `[${index + 1}] ${String(source.title || '참고 자료')}`); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; sourceArea.append(a); }); node.answer.append(sourceArea);
  }
  if (data.searchSuggestions) {
    const frame = document.createElement('iframe'); frame.className = 'travel-ai-search-suggestions'; frame.title = 'Google 검색 제안'; frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox'); frame.referrerPolicy = 'no-referrer';
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;padding:4px;font-family:system-ui,sans-serif;overflow-wrap:anywhere}body{max-width:100%}*{box-sizing:border-box}a{overflow-wrap:anywhere}</style></head><body>${data.searchSuggestions}</body></html>`;
    node.answer.append(frame);
  }
  if (data.truncated) node.answer.append(element('p', 'travel-ai-footnote', '답변이 길어 일부가 생략됐어요. 이어서 알고 싶은 부분을 질문해 주세요.'));
  const footer = element('div', 'travel-ai-answer-footer'); footer.append(element('span', '', data.searchUsed ? '웹 검색을 참고했어요' : '검색으로 확인되지 않은 정보는 방문 전 확인해 주세요'));
  const copy = element('button', '', '답변 복사'); copy.type = 'button'; copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(data.text); copy.textContent = '복사했어요'; setTimeout(() => { copy.textContent = '답변 복사'; }, 1600); } catch { showNotice('복사하지 못했어요. 답변을 길게 눌러 복사해 주세요.', true); } }); footer.append(copy); node.answer.append(footer);
  if (log.children.length > 8) log.firstElementChild.remove();
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (controller) return;
  const question = questionInput.value.trim();
  if (!question) { questionInput.focus(); return; }
  if (question.length > 2000) { showNotice('질문은 2,000자 이내로 적어 주세요.', true); return; }
  loadTrips();
  const selected = includeTrip.checked ? trips.find(t => t.id === tripSelect.value) : null;
  const trip = selected ? {title:selected.title,city:selected.city,start:selected.start,days:selected.days,budget:selected.budget,finance:{rate:selected.finance?.rate},activities:selected.activities.slice(0,40).map(a=>{const override=selected.finance?.overrides?.['activity:'+a.id];return {day:a.day,time:a.time,title:String(a.title||'').slice(0,120),category:a.category,note:String(a.note||'').slice(0,180),cost:override?((override.unit??a.cost)*(override.qty??1)):a.cost,costCurrency:override?.currency??a.costCurrency}})} : null;
  const token = ++requestNumber;
  const activeController = new AbortController(); controller = activeController;
  const timeout = setTimeout(() => activeController.abort('timeout'), 52000);
  setBusy(true); showNotice('');
  const pending = pendingAnswer(question);
  try {
    const response = await fetch('./api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', signal: activeController.signal, body: JSON.stringify({ question, history: history.slice(-6), trip: trip || null, useSearch: searchToggle.checked }) });
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) throw new Error('AI 연결 경로를 찾지 못했어요. GitHub Pages나 HTML 파일에서는 서버 API가 실행되지 않습니다. 이 저장소의 Vercel 배포 주소에서 열어 주세요.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '답변을 받지 못했어요. 다시 시도해 주세요.');
    if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('답변이 비어 있어요. 다시 시도해 주세요.');
    if (token !== requestNumber) return;
    finishAnswer(pending, data);
    history.push({ role: 'user', text: question }, { role: 'model', text: data.text }); history = history.slice(-6);
    if (questionInput.value.trim() === question) questionInput.value = '';
    showNotice('답변을 받았어요. 이어서 질문할 수 있어요.');
  } catch (error) {
    pending.item.remove();
    if (token === requestNumber) showNotice(activeController.signal.aborted ? (activeController.signal.reason === 'timeout' ? '응답이 늦어지고 있어요. 질문을 나누거나 검색을 끄고 다시 시도해 주세요.' : '요청을 중단했어요. 질문 내용은 그대로 남아 있어요.') : error.message, true);
  } finally { clearTimeout(timeout); if (token === requestNumber) { controller = null; setBusy(false); } }
});
cancelButton.addEventListener('click', () => controller?.abort('cancelled'));
includeTrip.addEventListener('change', () => { tripSelect.disabled = !trips.length || !includeTrip.checked; });
document.querySelector('#travel-ai-refresh').addEventListener('click', () => { loadTrips(); showNotice('저장한 여행 목록을 새로 불러왔어요.'); });
document.querySelectorAll('[data-ai-question]').forEach(button => button.addEventListener('click', () => { questionInput.value = button.dataset.aiQuestion; questionInput.focus({ preventScroll: true }); questionInput.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }));
document.querySelector('#travel-ai-reset').addEventListener('click', () => { if (controller) { showNotice('답변 생성을 중단한 뒤 대화를 지울 수 있어요.'); return; } history = []; log.replaceChildren(); showNotice('새 대화를 시작해 보세요.'); });
questionInput.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') form.requestSubmit(); });
window.addEventListener('focus', loadTrips);
window.addEventListener('storage', event => { if (event.key === storageKey) loadTrips(); });
loadTrips();
