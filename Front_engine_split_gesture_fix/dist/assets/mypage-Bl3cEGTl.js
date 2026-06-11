import{a as d,A as b,r as R,S as p,w as E}from"./api-BKxzwLzr.js";import{r as v,b as T,g as I}from"./auth-DmAaZA39.js";const s=document.getElementById("presentationRecordList"),o=document.getElementById("latestRecordDate"),r=document.getElementById("latestRecordDateDesc"),i=document.getElementById("recordCount"),c=document.getElementById("latestRecordTime"),l=document.getElementById("latestRecordTimeDesc");v("../index.html");function u(){return R(localStorage,p.presentationRecords,[])}async function h(){const e=I().userId;if(!e)return null;try{return((await b.listPresentations(e)).data||[]).map(t=>{var a;return{schemaVersion:d,id:`server-${t.presentationId}`,presentationId:t.presentationId,pdfId:t.pdfId,fileName:t.fileName||`PDF #${t.pdfId||"-"}`,presentationDate:t.startTime?String(t.startTime).slice(0,10).replaceAll("-","."):"-",elapsedTime:t.endTime?"완료":"진행 중",progressRate:t.endTime?100:0,annotationCount:((a=t.recordImages)==null?void 0:a.length)||0,recordImages:t.recordImages||[],startTime:t.startTime,endTime:t.endTime}})}catch(n){return console.warn("AirNote mypage: backend presentation list failed, using local records.",n),null}}function y(e){E(localStorage,p.presentationRecords,e)}function m(e){return e.presentationDate||e.date||"-"}function f(e){return e.elapsedTime||e.elapsedText||"00:00"}function x(e){const n=e.progressRate??e.progressPercent;return Number.isFinite(Number(n))?`${Number(n)}%`:"0%"}function w(e){const n=e[0];o&&(o.textContent=n?m(n):"-"),r&&(r.textContent=n?"가장 최근 발표 날짜":"저장된 발표 기록이 없습니다."),i&&(i.textContent=`${e.length}건`),c&&(c.textContent=n?f(n):"-"),l&&(l.textContent=n?"가장 최근 발표 시간":"저장된 발표 기록이 없습니다.")}function D(e){window.confirm("삭제하시겠습니까?")&&(y(u().filter(n=>n.id!==e)),g())}function k(e){const n=document.createElement("article");return n.className="presentation-record",n.innerHTML=`
    <div class="record-left-group">
      <p class="record-info-row">
        <span class="record-icon-box file"><span class="record-line-icon icon-mask icon-record-file" aria-hidden="true"></span></span>
        <span class="record-info-label">발표 자료명:</span>
        <strong class="record-info-value record-file-name"></strong>
      </p>
      <p class="record-info-row">
        <span class="record-icon-box time"><span class="record-line-icon icon-mask icon-record-time" aria-hidden="true"></span></span>
        <span class="record-info-label">발표 시간:</span>
        <span class="record-info-value">${f(e)}</span>
      </p>
    </div>
    <div class="record-middle-group">
      <div class="record-middle-top">
        <p class="record-info-row">
          <span class="record-icon-box date"><span class="record-line-icon icon-mask icon-record-date" aria-hidden="true"></span></span>
          <span class="record-info-label">발표 날짜:</span>
          <span class="record-info-value">${m(e)}</span>
        </p>
        <p class="record-info-row">
          <span class="record-icon-box progress"><span class="record-line-icon icon-mask icon-record-progress" aria-hidden="true"></span></span>
          <span class="record-info-label">발표 경과율:</span>
          <span class="record-info-value">${x(e)}</span>
        </p>
      </div>
      <p class="record-info-row">
        <span class="record-icon-box annotation"><span class="record-line-icon icon-mask icon-record-annotations" aria-hidden="true"></span></span>
        <span class="record-info-label">저장된 판서:</span>
        <span class="record-info-value">${e.annotationCount||0}개</span>
      </p>
    </div>
    <div class="record-actions">
      <button class="delete-button delete-record-button" type="button"><span class="button-icon icon-mask icon-record-delete" aria-hidden="true"></span>삭제</button>
    </div>
  `,n.querySelector("strong").textContent=e.fileName||"선택된 발표 자료 없음",n.querySelector("button").addEventListener("click",()=>D(e.id)),n}async function g(){const n=await h()||u().map(t=>({schemaVersion:t.schemaVersion||d,...t}));if(w(n),!!s){if(s.innerHTML="",!n.length){s.innerHTML='<p class="empty-state">아직 저장된 발표 기록이 없습니다.</p>';return}n.forEach(t=>s.append(k(t)))}}T();g();
