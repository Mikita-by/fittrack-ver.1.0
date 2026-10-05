(function(){
  // 1. Добавляем кнопку и превью в карточку дневника питания
  const calCard = document.querySelector('#tab-calories .card');
  if(!calCard) return;

  const box = document.createElement('div');
  box.innerHTML = `
    <div style="margin:12px 0 8px">
      <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:6px">
        📷 Распознать еду по фото <span class="ai-badge">AI Vision</span>
      </label>
      <input type="file" id="foodPhoto" accept="image/*" capture="environment" hidden>
      <button class="btn ai block" onclick="document.getElementById('foodPhoto').click()">
        📸 Загрузить фото еды
      </button>
      <div id="foodPhotoPreview" style="margin-top:10px"></div>
      <div id="foodPhotoResult" style="margin-top:10px"></div>
    </div>
  `;
  const addBtn = calCard.querySelector('button.btn.block'); // кнопка «Добавить приём пищи»
  addBtn.parentNode.insertBefore(box, addBtn);

  // 2. Обработка загрузки
  document.getElementById('foodPhoto').addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    e.target.value = '';
    if(!file) return;
    if(!data.llm.key) return toast('Настройте ИИ в Настройках','err');

    const preview = document.getElementById('foodPhotoPreview');
    const result = document.getElementById('foodPhotoResult');

    // Сжатие фото (чтобы не превысить лимиты API)
    const base64 = await compressImage(file, 800, 0.75);
    preview.innerHTML = `<img src="${base64}" style="max-width:100%;border-radius:12px;box-shadow:var(--shadow)">`;
    result.innerHTML = `<div class="hint"><span class="spinner"></span> Анализирую фото…</div>`;

    try{
      const items = await analyzePhoto(base64);
      if(!items.length){
        result.innerHTML = '<div class="hint" style="color:var(--danger)">Не удалось распознать еду. Попробуйте другое фото.</div>';
        return;
      }
      result.innerHTML = `
        <div class="insight ai">
          <div class="icon">🤖</div>
          <div class="body">
            <h4>Распознано:</h4>
            <div id="foodItems"></div>
            <button class="btn block ai" style="margin-top:10px" onclick='addAllRecognized(${JSON.stringify(items).replace(/'/g,"&#39;")})'>
              ✅ Добавить всё в дневник (${items.reduce((s,i)=>s+i.kcal,0)} ккал)
            </button>
          </div>
        </div>
      `;
      document.getElementById('foodItems').innerHTML = items.map(it => `
        <div class="metric-bar">
          <div class="name" style="flex-basis:auto">${escapeHtml(it.name)}</div>
          <div class="val">${it.kcal} ккал</div>
        </div>
      `).join('');
    }catch(err){
      result.innerHTML = `<div class="hint" style="color:var(--danger)">Ошибка: ${escapeHtml(err.message)}</div>`;
    }
  });

  // 3. Добавление всех распознанных блюд в data.meals
  window.addAllRecognized = function(items){
    const date = document.getElementById('cDate').value || todayISO();
    const time = new Date().toTimeString().slice(0,5);
    items.forEach(it => {
      data.meals.push({
        id: Date.now()+'_'+Math.random().toString(36).slice(2,6),
        date, name: it.name, kcal: it.kcal, time
      });
    });
    save(); renderAll();
    document.getElementById('foodPhotoPreview').innerHTML = '';
    document.getElementById('foodPhotoResult').innerHTML = '';
    toast(`Добавлено ${items.length} блюд(а)`,'ok');
  };

  // 4. Сжатие изображения
  function compressImage(file, maxSize, quality){
    return new Promise((res, rej)=>{
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if(w > h && w > maxSize){ h = h * maxSize / w; w = maxSize; }
          else if(h > maxSize){ w = w * maxSize / h; h = maxSize; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          res(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = rej;
        img.src = reader.result;
      };
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  }

  // 5. Запрос в vision-API
  async function analyzePhoto(base64){
    const prompt = 'Ты — нутрициолог. Посмотри на фото еды и верни ТОЛЬКО валидный JSON без markdown и без пояснений в формате: {"items":[{"name":"блюдо на русском","kcal":число}]}. Оценивай калории реалистично по видимой порции. Если на фото несколько блюд — перечисли все.';

    const body = {
      model: data.llm.model,
      messages: [{
        role:'user',
        content:[
          {type:'text', text:prompt},
          {type:'image_url', image_url:{url:base64}}
        ]
      }],
      temperature:0.2,
      max_tokens:500
    };

    const resp = await fetch(data.llm.endpoint + '/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer ' + data.llm.key},
      body: JSON.stringify(body)
    });
    if(!resp.ok){
      const t = await resp.text();
      throw new Error(`${resp.status}: ${t.slice(0,150)}`);
    }
    const json = await resp.json();
    let text = json.choices?.[0]?.message?.content || '';
    // Чистим возможные ```json обёртки
    text = text.replace(/```json\s*/i,'').replace(/```/g,'').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if(start >= 0 && end > start) text = text.slice(start, end+1);
    let parsed;
    try{ parsed = JSON.parse(text); }
    catch(e){ throw new Error('ИИ вернул не JSON: ' + text.slice(0,100)); }
    return (parsed.items || []).filter(it => it && it.name && it.kcal);
  }

  // Хук в renderAll не нужен — всё локально
})();