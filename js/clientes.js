// — DOM refs —
const form       = document.getElementById('form-cliente');
const listaAnt   = document.getElementById('lista-anticipados');
const listaPen   = document.getElementById('lista-pendientes');
const tabla20    = document.getElementById('tabla20');
const tabla10    = document.getElementById('tabla10');
const undoBtn    = document.getElementById('undo-btn');
const redoBtn    = document.getElementById('redo-btn');
const monthSel   = document.getElementById('month-selector');

// — Estado & pilas —
let clientes   = JSON.parse(localStorage.getItem('clientes') || '[]');
let undoStack  = [];
let redoStack  = [];
let activeMonth = null;

// — Fecha helpers —
function parseDate(str) {
  const [y,m,d] = str.split('-').map(Number);
  return new Date(y, m-1, d);
}
function formatDate(str) {
  return parseDate(str).toLocaleDateString('es-PE');
}
function calcCut(str, meses) {
  const d = parseDate(str);
  d.setMonth(d.getMonth() + meses);
  return d.toLocaleDateString('es-PE');
}

// — Guardar en localStorage —
function salvar() {
  localStorage.setItem('clientes', JSON.stringify(clientes));
}

// — Meses únicos en tus datos —
function getMonths() {
  const setMes = new Set();
  clientes.forEach(c => {
    const d = parseDate(c.fechaInicio);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    setMes.add(key);
  });
  return Array.from(setMes).sort();
}

// — Render selector de meses —
function renderMonthSelector() {
  const meses = getMonths();
  if (!activeMonth && meses.length) activeMonth = meses[0];
  monthSel.innerHTML = meses.map(m => {
    const [yy,mo] = m.split('-');
    const name = new Date(yy,mo-1)
      .toLocaleString('es-PE',{month:'long',year:'numeric'});
    return `<button class="${m===activeMonth?'active':''}" data-mo="${m}">${name}</button>`;
  }).join('');
  monthSel.querySelectorAll('button').forEach(btn=>{
    btn.onclick = () => {
      activeMonth = btn.dataset.mo;
      render();
    };
  });
}

// — Undo / Redo —
function updateUR() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}
undoBtn.onclick = () => {
  const act = undoStack.pop();
  if (!act) return;
  if (act.type==='delete') clientes.splice(act.index,0,act.client);
  redoStack.push(act);
  salvar(); render();
};
redoBtn.onclick = () => {
  const act = redoStack.pop();
  if (!act) return;
  if (act.type==='delete') clientes.splice(act.index,1);
  undoStack.push(act);
  salvar(); render();
};

// — Render completo —
function render() {
  // limpia UI
  listaAnt.innerHTML = '';
  listaPen.innerHTML = '';
  tabla20.innerHTML = '';
  tabla10.innerHTML = '';
  updateUR();
  renderMonthSelector();

  // filtra por mes activo
  const filtrados = clientes.filter(c => {
    const d = parseDate(c.fechaInicio);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return key === activeMonth;
  });

  const today = new Date(); today.setHours(0,0,0,0);
  const ant2   = new Date(today); ant2.setDate(ant2.getDate()+2);

  // normaliza datos antiguos
  filtrados.forEach(c => {
    if (typeof c.duracion!=='number') c.duracion=1;
    if (typeof c.cobrada!=='boolean')  c.cobrada=false;
  });

  // Cobro anticipado y pendientes
  filtrados.forEach(c => {
    const start = parseDate(c.fechaInicio),
          due   = new Date(start);
    due.setMonth(due.getMonth()+c.duracion);
    due.setHours(0,0,0,0);

    if (due.getTime()===ant2.getTime()) {
      listaAnt.innerHTML += `<li>${c.nombre} (${c.cuenta}) vence el ${due.toLocaleDateString('es-PE')}</li>`;
    }
    if (due.getTime()===today.getTime()) {
      const idx = clientes.indexOf(c);
      listaPen.innerHTML += `
        <li>${c.nombre} (${c.cuenta}) vence hoy
          <button class="${c.cobrada?'cobrado-btn':'cobrar-btn'}" data-idx="${idx}">
            ${c.cobrada?'Cobrado':'Cobrar'}
          </button>
        </li>`;
    }
  });
  if (!listaAnt.children.length) listaAnt.innerHTML='<li>– No hay avisos –</li>';
  if (!listaPen.children.length) listaPen.innerHTML='<li>– No hay cobros –</li>';

  // Cuentas 20 S/
  const grp20 = {};
  filtrados.forEach(c => {
    if (c.servicio==='20') (grp20[c.cuenta]=grp20[c.cuenta]||[]).push(c);
  });
  Object.entries(grp20).forEach(([acct,arr])=>{
    let rows = arr.map((c,i)=> {
      const idx = clientes.indexOf(c);
      return `
        <tr>
          <td>${i+1}</td><td>${c.nombre}</td><td>${formatDate(c.fechaInicio)}</td>
          <td>${c.duracion}</td><td>${calcCut(c.fechaInicio,c.duracion)}</td>
          <td>S/${c.servicio},00</td>
          <td>
            <button class="edit-btn"   data-idx="${idx}">Editar</button>
            <button class="delete-btn" data-idx="${idx}">Eliminar</button>
          </td>
        </tr>`;
    }).join('');
    rows += `<tr class="total-row"><td colspan="5">Total</td>
      <td>S/${arr.length*20},00</td><td></td></tr>`;
    tabla20.innerHTML += `
      <h3>Grupo: ${acct}</h3>
      <table>
        <thead><tr>
          <th>#</th><th>Usuario</th><th>Inicio</th><th>Durac.</th>
          <th>Corte</th><th>Monto</th><th>Acción</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  });

  // Cuentas 10 S/
  const arr10 = filtrados.filter(c=>c.servicio==='10');
  if (arr10.length) {
    let rows = arr10.map((c,i)=>{
      const idx = clientes.indexOf(c);
      return `
        <tr>
          <td>${i+1}</td><td>${c.nombre}</td><td>${c.cuenta}</td>
          <td>${formatDate(c.fechaInicio)}</td><td>${c.duracion}</td>
          <td>${calcCut(c.fechaInicio,c.duracion)}</td>
          <td>S/${c.servicio},00</td>
          <td>
            <button class="edit-btn"   data-idx="${idx}">Editar</button>
            <button class="delete-btn" data-idx="${idx}">Eliminar</button>
          </td>
        </tr>`;
    }).join('');
    rows += `<tr class="total-row"><td colspan="6">Total</td>
      <td>S/${arr10.length*10},00</td><td></td></tr>`;
    tabla10.innerHTML = `
      <table>
        <thead><tr>
          <th>#</th><th>Usuario</th><th>Cuenta</th><th>Inicio</th>
          <th>Durac.</th><th>Corte</th><th>Monto</th><th>Acción</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // Listeners
  document.querySelectorAll('.cobrar-btn, .cobrado-btn').forEach(btn=>{
    btn.onclick = ()=>{
      const i = +btn.dataset.idx;
      clientes[i].cobrada = !clientes[i].cobrada;
      salvar(); render();
    };
  });
  document.querySelectorAll('.delete-btn').forEach(btn=>{
    btn.onclick = ()=>{
      const i = +btn.dataset.idx;
      undoStack.push({type:'delete',client:clientes[i],index:i});
      redoStack=[]; salvar();
      clientes.splice(i,1); render();
    };
  });
  document.querySelectorAll('.edit-btn').forEach(btn=>{
    btn.onclick = ()=>{
      const i = +btn.dataset.idx;
      const c = clientes[i];
      const choice = prompt(
        '¿Qué editar?\n1: Cuenta\n2: Fecha inicio\n3: Duración meses',
        '1'
      );
      if (choice==='1') {
        const nu = prompt('Nueva cuenta:', c.cuenta);
        if (nu) c.cuenta = nu.trim();
      } else if (choice==='2') {
        const nf = prompt(
          'Nueva fecha inicio (YYYY-MM-DD):',
          c.fechaInicio
        );
        if (/^\d{4}-\d{2}-\d{2}$/.test(nf)) c.fechaInicio = nf;
      } else if (choice==='3') {
        const nd = prompt('Nueva duración meses:', c.duracion);
        if (!isNaN(nd)) c.duracion = parseInt(nd,10);
      }
      salvar(); render();
    };
  });
}

// — Alta de cliente —
form.addEventListener('submit', e=>{
  e.preventDefault();
  clientes.push({
    nombre:      form.nombre.value.trim(),
    cuenta:      form.cuenta.value.trim(),
    servicio:    form.servicio.value,
    duracion:    parseInt(form.duracion.value,10),
    fechaInicio: form.fechaInicio.value,
    cobrada: false
  });
  salvar(); render(); form.reset();
});

// — Inicia —
render();
