(function(){
  if(!Array.isArray(data.sleep)) data.sleep = [];
  if(data.profile.sleepGoal == null) data.profile.sleepGoal = 8;

  const tabs = document.getElementById('tabs');
  const btn = document.createElement('button');
  btn.dataset.tab = 'sleep';
  btn.textContent = '😴 Сон';
  tabs.appendChild(btn);

  const sec = document.createElement('section');
  sec.id = 'tab-sleep';
  sec.className = 'tab';
  sec.innerHTML = `
    <div class="card">
      <h2>➕ Записать сон</h2>
      <div class="row">
        <div><label>Дата (день пробуждения)</label><input type="date" id="slDate"></div>
      </div>
      <div class="row">
        <div><label>Лёг спать</label><input type="time" id="slFrom" value="23:00"></div>
        <div><label>Проснулся</label><input type="time" id="slTo" value="07:00"></div>
      </div>
      <div class="row">
        <div><label>Качество</label>
          <select id="slQuality">
            <option value="5">😴 Отличное (5)</option>
            <option value="4" selected>😊 Хорошее (4)</option>
            <option value="3">😐 Среднее (3)</option>
            <option value="2">😕 Плохое (2)</option>
            <option value="1">😫 Ужасное (1)</option>
          </select>
        </div>
        <div><label>Заметка</label><input id="slNote" placeholder="кофеин, стресс…"></div>
      </div>
      <button class="btn block" onclick="addSleep()">Сохранить сон</button>
      <div id="slPreview" class="hint"></div>
    </div>
    <div class="card">
      <h2>📊 За 7 дней</h2>
      <canvas id="sleepChart" class="chart"></canvas>
    </div>
    <div class="card">
      <h2>📈 Статистика</h2>
      <div class="stats" id="sleepStats"></div>
    </div>
    <div class="card">
      <h2>🎯 Норма сна</h2>
      <div class="row">
        <input type="number" id="sleepGoal" step="0.5" placeholder="часов">
        <button class="btn" onclick="saveSleepGoal()">Сохранить</button>
      </div>
    </div>
    <div class="card">
      <h2>📋 История <small id="slCount"></small></h2>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Дата</th><th>Лёг</th><th>Встал</th><th>Часов</th><th>Кач.</th><th>Заметка</th><th></th></tr></thead>
          <tbody id="sleepList"></tbody>
        </table>
      </div>
    </div>
  `;
  document.querySelector('main').appendChild(sec);

  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    btn.classList.add('active');
    sec.classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
    setTimeout(renderSleep, 50);
  });

  function hoursBetween(from, to){
    const [fh, fm] = from.split(':').map(Number);
    const [th, tm] = to.split(':').map(Number);
    let mins = (th*60+tm) - (fh*60+fm);
    if(mins < 0) mins += 24*60; // через полночь
    return +(mins/60).toFixed(2);
  }
  function fmtHours(h){
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh} ч ${mm.toString().padStart(2,'0')} мин`;
  }

  window.addSleep = function(){
    const date = document.getElementById('slDate').value;
    const from = document.getElementById('slFrom').value;
    const to = document.getElementById('slTo').value;
    const quality = parseInt(document.getElementById('slQuality').value, 10);
    const note = document.getElementById('slNote').value.trim();
    if(!date || !from || !to) return toast('Заполните дату и время','err');
    const hours = hoursBetween(from, to);
    if(hours < 0.5 || hours > 16) return toast('Проверьте время','err');
    data.sleep = data.sleep.filter(e => e.date !== date);
    data.sleep.push({date, from, to, hours, quality, note});
    data.sleep.sort((a,b)=>a.date.localeCompare(b.date));
    save();
    document.getElementById('slNote').value = '';
    renderAll(); toast('Сон записан','ok');
  };
  window.saveSleepGoal = function(){
    const v = parseFloat(document.getElementById('sleepGoal').value);
    if(!v || v < 4 || v > 12) return toast('Введите 4–12 ч','err');
    data.profile.sleepGoal = v; save(); renderSleep(); toast('Норма сохранена','ok');
  };
  window.delSleep = function(date){
    if(!confirm('Удалить запись за '+fmtDate(date)+'?')) return;
    data.sleep = data.sleep.filter(e => e.date !== date);
    save(); renderAll();
  };

  // Превью при вводе времени
  function updatePreview(){
    const f = document.getElementById('slFrom').value;
    const t = document.getElementById('slTo').value;
    if(f && t){
      const h = hoursBetween(f, t);
      document.getElementById('slPreview').innerHTML = `⏱️ Планируемая длительность: <b>${fmtHours(h)}</b>`;
    }
  }
  document.getElementById('slFrom').addEventListener('change', updatePreview);
  document.getElementById('slTo').addEventListener('change', updatePreview);

  function sleepForDate(d){
    const e = data.sleep.find(x => x.date === d);
    return e ? e.hours : 0;
  }

  function renderSleep(){
    const goal = data.profile.sleepGoal || 8;
    document.getElementById('sleepGoal').value = goal;

    // График за 7 дней
    if(sec.classList.contains('active') && typeof drawBarChart === 'function'){
      const bars = [];
      for(let i = 6; i >= 0; i--){
        const d = new Date(); d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0,10);
        const lbl = d.toLocaleDateString('ru-RU', {weekday:'short'});
        bars.push({label: lbl, value: sleepForDate(iso)});
      }
      drawBarChart(document.getElementById('sleepChart'), bars, {goal});
    }

    // Статистика
    const last7 = [];
    for(let i = 6; i >= 0; i--){
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0,10);
      const h = sleepForDate(iso);
      if(h > 0) last7.push(h);
    }
    const avg = last7.length ? (last7.reduce((a,b)=>a+b,0)/last7.length) : 0;
    const best = last7.length ? Math.max(...last7) : 0;
    const worst = last7.length ? Math.min(...last7) : 0;
    const last30 = data.sleep.slice(-30);
    const avgQual = last30.length ? (last30.reduce((s,e)=>s+e.quality,0)/last30.length) : 0;

    document.getElementById('sleepStats').innerHTML = `
      <div class="stat"><div class="lbl">Средний сон</div><div class="val ${avg>=goal?'good':avg>0?'warn':''}">${avg?fmtHours(avg):'—'}</div></div>
      <div class="stat"><div class="lbl">Макс (7 дн.)</div><div class="val">${best?fmtHours(best):'—'}</div></div>
      <div class="stat"><div class="lbl">Мин (7 дн.)</div><div class="val">${worst?fmtHours(worst):'—'}</div></div>
      <div class="stat"><div class="lbl">Качество</div><div class="val">${avgQual?avgQual.toFixed(1)+'/5':'—'}</div></div>
      <div class="stat"><div class="lbl">Записей</div><div class="val">${data.sleep.length}</div></div>
    `;

    // История
    const list = [...data.sleep].reverse();
    document.getElementById('slCount').textContent = list.length ? `(${list.length})` : '';
    document.getElementById('sleepList').innerHTML = list.length
      ? list.map(e => `<tr>
          <td>${fmtDate(e.date)}</td>
          <td>${e.from}</td>
          <td>${e.to}</td>
          <td><b>${fmtHours(e.hours)}</b></td>
          <td>${'⭐'.repeat(e.quality)}</td>
          <td style="font-size:12px;color:var(--muted)">${escapeHtml(e.note||'')}</td>
          <td style="text-align:right"><button class="del" onclick="delSleep('${e.date}')">✕</button></td>
        </tr>`).join('')
      : '<tr><td colspan="7" class="empty">Пока нет записей</td></tr>';
  }

  // Хук в renderAll — extras.js загружается последним
  const origRenderAll = window.renderAll;
  window.renderAll = function(){ origRenderAll(); renderSleep(); };

  // Инициализация даты
  setTimeout(()=>{ document.getElementById('slDate').value = todayISO(); }, 0);
})();