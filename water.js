(function(){
  if(!Array.isArray(data.water)) data.water = [];
  if(data.profile.waterGoal == null) data.profile.waterGoal = 2000;

  const tabs = document.getElementById('tabs');
  const btn = document.createElement('button');
  btn.dataset.tab = 'water';
  btn.textContent = '💧 Вода';
  tabs.appendChild(btn);

  const sec = document.createElement('section');
  sec.id = 'tab-water';
  sec.className = 'tab';
  sec.innerHTML = `
    <div class="card">
      <h2>💧 Вода сегодня <small id="wToday"></small></h2>
      <div class="stats" id="waterStats"></div>
      <div class="progress"><div id="waterProgress" style="width:0%"></div></div>
      <div class="row" style="margin-top:12px">
        <button class="btn" onclick="addWater(200)">+200 мл</button>
        <button class="btn" onclick="addWater(250)">+250 мл</button>
        <button class="btn" onclick="addWater(500)">+500 мл</button>
        <button class="btn sec" onclick="addWater(-200)">−200 мл</button>
      </div>
    </div>
    <div class="card">
      <h2>🎯 Дневная цель</h2>
      <div class="row">
        <input type="number" id="waterGoal" step="50" placeholder="мл">
        <button class="btn" onclick="saveWaterGoal()">Сохранить</button>
      </div>
      <div class="hint">Рекомендуется 30 мл на 1 кг веса. При 70 кг — около 2100 мл.</div>
    </div>
    <div class="card">
      <h2>📊 За 7 дней</h2>
      <canvas id="waterChart" class="chart"></canvas>
    </div>
    <div class="card">
      <h2>📋 История сегодня</h2>
      <div id="waterList"></div>
    </div>
  `;
  document.querySelector('main').appendChild(sec);

  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    btn.classList.add('active');
    sec.classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
    setTimeout(renderWater, 50);
  });

  window.addWater = function(ml){
    data.water.push({
      id: Date.now()+'_'+Math.random().toString(36).slice(2,6),
      date: todayISO(),
      ml,
      time: new Date().toTimeString().slice(0,5)
    });
    save(); renderWater();
    toast((ml>0?'+':'') + ml + ' мл', ml>0 ? 'ok' : '');
  };
  window.saveWaterGoal = function(){
    const v = parseInt(document.getElementById('waterGoal').value, 10);
    if(!v || v < 500 || v > 10000) return toast('Введите 500–10000 мл','err');
    data.profile.waterGoal = v; save(); renderWater(); toast('Цель сохранена','ok');
  };
  window.delWater = function(id){
    data.water = data.water.filter(x => x.id !== id);
    save(); renderWater();
  };

  function waterForDate(d){
    return data.water.filter(x => x.date === d).reduce((s,x) => s + (x.ml||0), 0);
  }

  function renderWater(){
    const today = todayISO();
    const goal = data.profile.waterGoal || 2000;
    const drunk = waterForDate(today);
    document.getElementById('wToday').textContent = fmtDate(today);
    document.getElementById('waterStats').innerHTML = `
      <div class="stat"><div class="lbl">Выпито</div><div class="val">${drunk}<span style="font-size:12px"> мл</span></div></div>
      <div class="stat"><div class="lbl">Цель</div><div class="val">${goal}<span style="font-size:12px"> мл</span></div></div>
      <div class="stat"><div class="lbl">Осталось</div><div class="val ${drunk>=goal?'good':''}">${Math.max(0,goal-drunk)}<span style="font-size:12px"> мл</span></div></div>
    `;
    const pct = Math.min(100, drunk/goal*100);
    const pb = document.getElementById('waterProgress');
    pb.style.width = pct + '%';
    pb.textContent = pct > 10 ? Math.round(pct) + '%' : '';
    pb.style.background = drunk >= goal
      ? 'linear-gradient(90deg,var(--success),#38a169)'
      : 'linear-gradient(90deg,#63b3ed,#3182ce)';
    document.getElementById('waterGoal').value = goal;

    const items = data.water.filter(x => x.date === today).sort((a,b) => (a.time||'').localeCompare(b.time||''));
    document.getElementById('waterList').innerHTML = items.length
      ? `<table><thead><tr><th>Время</th><th>Объём</th><th></th></tr></thead><tbody>
         ${items.map(x => `<tr><td>${x.time||''}</td><td><b>${x.ml} мл</b></td>
           <td style="text-align:right"><button class="del" onclick="delWater('${x.id}')">✕</button></td></tr>`).join('')}
         </tbody></table>`
      : '<div class="empty">Пока пусто. Добавьте первый стакан 💧</div>';

    if(sec.classList.contains('active') && typeof drawBarChart === 'function'){
      const bars = [];
      for(let i = 6; i >= 0; i--){
        const d = new Date(); d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0,10);
        const lbl = d.toLocaleDateString('ru-RU', {weekday:'short'});
        bars.push({label: lbl, value: waterForDate(iso)});
      }
      drawBarChart(document.getElementById('waterChart'), bars, {goal});
    }
  }

  const origRenderAll = window.renderAll;
  window.renderAll = function(){ origRenderAll(); renderWater(); };
})();