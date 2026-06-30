(function () {
  "use strict";

  // -------- Configuración de acceso --------
  // Clave simple compartida con las agencias socias (no es una contraseña por agencia).
  var CLAVE_ACCESO = "sarmiento231";
  var SESSION_KEY = "cb_tarifario_unlocked";

  var DATA_URL = "data/excursiones.json";
  var DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "miércoles", "jueves", "viernes", "sabado", "sábado"];

  var data = null; // JSON cargado
  var excursionesById = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    document.getElementById("anio").textContent = new Date().getFullYear();
    setupLogin();
    setupModal();
    setupFilters();
    setupArmadorForm();

    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      unlock();
    }
  }

  // ===================== LOGIN =====================

  function setupLogin() {
    var form = document.getElementById("login-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = document.getElementById("clave").value.trim();
      if (val === CLAVE_ACCESO) {
        sessionStorage.setItem(SESSION_KEY, "1");
        unlock();
      } else {
        document.getElementById("login-error").hidden = false;
      }
    });

    document.getElementById("logout-btn").addEventListener("click", function () {
      sessionStorage.removeItem(SESSION_KEY);
      location.reload();
    });

    var toggleBtn = document.getElementById("toggle-clave");
    var claveInput = document.getElementById("clave");
    toggleBtn.addEventListener("click", function () {
      var visible = claveInput.type === "text";
      claveInput.type = visible ? "password" : "text";
      toggleBtn.setAttribute("aria-pressed", String(!visible));
      toggleBtn.setAttribute("aria-label", visible ? "Mostrar clave" : "Ocultar clave");
      toggleBtn.innerHTML = visible ? "&#128065;" : "&#128584;";
    });
  }

  function unlock() {
    document.getElementById("login-screen").hidden = true;
    document.getElementById("app").hidden = false;
    if (!data) {
      cargarDatos();
    }
  }

  // ===================== CARGA DE DATOS =====================

  function cargarDatos() {
    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("No se pudo cargar " + DATA_URL);
        return res.json();
      })
      .then(function (json) {
        data = json;
        excursionesById = {};
        data.excursiones.forEach(function (ex) { excursionesById[ex.id] = ex; });
        renderTarifario("todas");
        renderContacto();
      })
      .catch(function (err) {
        var list = document.getElementById("tarifario-list");
        list.innerHTML = '<p class="armador-mensaje">No se pudieron cargar los datos del tarifario (' + escapeHtml(err.message) + '). Si estás abriendo el archivo directamente (file://), probá servirlo con un servidor local.</p>';
        console.error(err);
      });
  }

  // ===================== HELPERS DE PRECIO =====================

  function calcularNeto(ex) {
    var pub = ex.precios.efectivo_transferencia;
    var pct = ex.comision_pct || 0;
    return Math.round(pub * (1 - pct / 100));
  }

  function formatoMoneda(n) {
    if (n === null || n === undefined) return "—";
    return "$" + Math.round(n).toLocaleString("es-AR");
  }

  function capitalizar(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // ===================== RENDER TARIFARIO =====================

  function setupFilters() {
    var filters = document.getElementById("filters");
    filters.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;
      filters.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      renderTarifario(btn.dataset.filter);
    });
  }

  function renderTarifario(filtro) {
    if (!data) return;
    var list = document.getElementById("tarifario-list");
    list.innerHTML = "";

    var excursiones = data.excursiones.filter(function (ex) {
      return filtro === "todas" || ex.categoria === filtro;
    });

    excursiones.forEach(function (ex) {
      list.appendChild(crearTarjetaExcursion(ex));
    });
  }

  function crearTarjetaExcursion(ex) {
    var card = document.createElement("div");
    card.className = "excursion-card";
    card.tabIndex = 0;
    card.addEventListener("click", function () { mostrarDetalle(ex.id); });

    var neto = calcularNeto(ex);
    var promoHtml = "—";
    if (ex.precios.promo) {
      promoHtml = '<span class="precio-item__valor promo">' + formatoMoneda(ex.precios.promo.precio) + '</span>';
    }

    var badge = ex.categoria === "dia-completo" ? "Día completo" : "Medio día";

    card.innerHTML =
      '<div class="excursion-card__top">' +
        '<div class="excursion-card__nombre">' + escapeHtml(ex.nombre) + '</div>' +
        '<div class="excursion-card__badge">' + badge + '</div>' +
      '</div>' +
      '<div class="excursion-card__meta">' + escapeHtml(ex.salidas) + ' · ' + escapeHtml(ex.horario) + '</div>' +
      '<div class="excursion-card__precios">' +
        '<div class="precio-item"><span class="precio-item__label">Efectivo/Transf.</span><span class="precio-item__valor">' + formatoMoneda(ex.precios.efectivo_transferencia) + '</span></div>' +
        '<div class="precio-item"><span class="precio-item__label">Promo</span>' + promoHtml + '</div>' +
        '<div class="precio-item"><span class="precio-item__label">Tarjeta</span><span class="precio-item__valor">' + formatoMoneda(ex.precios.tarjeta ? ex.precios.tarjeta.precio : null) + (ex.precios.tarjeta && ex.precios.tarjeta.cuotas ? ' (' + ex.precios.tarjeta.cuotas + ' cuotas)' : '') + '</span></div>' +
        '<div class="precio-item"><span class="precio-item__label">Comisión</span><span class="precio-item__valor">' + ex.comision_pct + '%</span></div>' +
      '</div>' +
      '<div class="excursion-card__neto"><span class="label">Neto agencia</span><span class="valor">' + formatoMoneda(neto) + '</span></div>';

    return card;
  }

  // ===================== MODAL DE DETALLE =====================

  function setupModal() {
    document.getElementById("modal-backdrop").addEventListener("click", cerrarModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") cerrarModal();
    });
  }

  function cerrarModal() {
    document.getElementById("detalle-modal").hidden = true;
  }

  function mostrarDetalle(id) {
    var ex = excursionesById[id];
    if (!ex) return;
    var neto = calcularNeto(ex);

    var lista = function (arr, vacio) {
      if (!arr || arr.length === 0) return '<p>' + (vacio || "—") + '</p>';
      return '<ul>' + arr.map(function (i) { return '<li>' + escapeHtml(i) + '</li>'; }).join("") + '</ul>';
    };

    var promoTxt = ex.precios.promo
      ? formatoMoneda(ex.precios.promo.precio) + ' (' + ex.precios.promo.dias.map(capitalizar).join(", ") + ')'
      : "Sin promoción";

    var extrasHtml = "";
    if (ex.extras_opcionales && ex.extras_opcionales.length) {
      extrasHtml = '<h4>Extras opcionales</h4><ul>' + ex.extras_opcionales.map(function (x) {
        return '<li>' + escapeHtml(x.nombre) + ' — ' + formatoMoneda(x.precio) + '</li>';
      }).join("") + '</ul>';
    }

    var notasHtml = "";
    if (ex.notas && ex.notas.length) {
      notasHtml = '<h4>Notas</h4>' + lista(ex.notas);
    }

    var content = document.getElementById("modal-content");
    content.innerHTML =
      '<button class="modal-close" aria-label="Cerrar">&times;</button>' +
      '<h3>' + escapeHtml(ex.nombre) + '</h3>' +
      '<p>' + escapeHtml(ex.salidas) + ' · ' + escapeHtml(ex.horario) + (ex.duracion_horas ? ' · ' + ex.duracion_horas + ' hs' : '') + '</p>' +
      (ex.pickup ? '<p><strong>Pickup:</strong> ' + escapeHtml(ex.pickup) + '</p>' : '') +
      '<h4>Recorrido</h4>' + lista(ex.recorrido) +
      '<h4>Incluye</h4>' + lista(ex.incluye, "No especificado") +
      '<h4>No incluye</h4>' + lista(ex.no_incluye, "Nada adicional") +
      extrasHtml + notasHtml +
      '<div class="modal-precios">' +
        '<div class="precio-item"><span class="precio-item__label">Efectivo/Transf.</span><span class="precio-item__valor">' + formatoMoneda(ex.precios.efectivo_transferencia) + '</span></div>' +
        '<div class="precio-item"><span class="precio-item__label">Promo</span><span class="precio-item__valor promo">' + promoTxt + '</span></div>' +
        '<div class="precio-item"><span class="precio-item__label">Tarjeta</span><span class="precio-item__valor">' + formatoMoneda(ex.precios.tarjeta ? ex.precios.tarjeta.precio : null) + '</span></div>' +
        '<div class="precio-item"><span class="precio-item__label">Neto agencia (' + ex.comision_pct + '% com.)</span><span class="precio-item__valor neto">' + formatoMoneda(neto) + '</span></div>' +
      '</div>';

    content.querySelector(".modal-close").addEventListener("click", cerrarModal);
    document.getElementById("detalle-modal").hidden = false;
  }

  // ===================== CONTACTO =====================

  function renderContacto() {
    var ag = data.agencia;
    var el = document.getElementById("contacto-info");
    el.innerHTML =
      '<p><strong>' + escapeHtml(ag.nombre) + '</strong> — ' + escapeHtml(ag.red) + '</p>' +
      '<p>' + escapeHtml(ag.direccion) + '</p>' +
      '<p>WhatsApp: ' + escapeHtml(ag.whatsapp) + '</p>' +
      '<p>Instagram: ' + escapeHtml(ag.instagram) + '</p>';
  }

  // ===================== ARMADOR DE EXPERIENCIAS =====================

  // Estado mutable de la propuesta actual (para personalización)
  var propuestaActual = null;

  function setupArmadorForm() {
    var form = document.getElementById("armador-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!data) return;

      var presupuesto = parseFloat(document.getElementById("presupuesto").value);
      var dias = parseInt(document.getElementById("dias").value, 10);
      var personas = parseInt(document.getElementById("personas").value, 10);
      var fechaInicioStr = document.getElementById("fecha-inicio").value;

      if (!presupuesto || !dias || !personas) return;

      var presupuestoPorPersona = presupuesto / personas;
      var fechaInicio = fechaInicioStr ? new Date(fechaInicioStr + "T00:00:00") : null;

      var resultado = armarPropuesta(data.excursiones, dias, presupuestoPorPersona, fechaInicio);

      propuestaActual = {
        asignacion: resultado.asignacion,
        dias: dias,
        presupuesto: presupuesto,
        presupuestoPorPersona: presupuestoPorPersona,
        personas: personas,
        fechaInicio: fechaInicio
      };

      renderResultadoArmador();
    });

    // Delegación de eventos para reemplazos
    document.getElementById("armador-resultado").addEventListener("click", function (e) {
      var toggleBtn = e.target.closest(".reemplazo-toggle");
      var optionBtn = e.target.closest(".reemplazo-opcion");

      if (toggleBtn) {
        var diaIdx = parseInt(toggleBtn.dataset.dia, 10);
        var panel = document.getElementById("reemplazo-panel-" + diaIdx);
        var abierto = panel.hidden === false;
        // Cerrar todos los paneles
        document.querySelectorAll(".reemplazo-panel").forEach(function (p) { p.hidden = true; });
        document.querySelectorAll(".reemplazo-toggle").forEach(function (b) { b.classList.remove("activo"); });
        if (!abierto) {
          panel.hidden = false;
          toggleBtn.classList.add("activo");
        }
        return;
      }

      if (optionBtn) {
        var diaIdx = parseInt(optionBtn.dataset.dia, 10);
        var exId = optionBtn.dataset.exid;
        var precio = parseFloat(optionBtn.dataset.precio);
        var ex = excursionesById[exId];
        if (!ex) return;
        propuestaActual.asignacion[diaIdx] = { ex: ex, precio: precio };
        renderResultadoArmador();
        return;
      }
    });
  }

  // Devuelve el nombre normalizado del día de la semana (sin tildes) para un índice de día (0=primer día)
  function nombreDiaSemana(fechaInicio, diaIndex) {
    if (!fechaInicio) return null;
    var f = new Date(fechaInicio.getTime());
    f.setDate(f.getDate() + diaIndex);
    var dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    return dias[f.getDay()];
  }

  function normalizar(s) {
    return s.toLowerCase()
      .replace(/á/g, "a").replace(/é/g, "e").replace(/í/g, "i")
      .replace(/ó/g, "o").replace(/ú/g, "u");
  }

  // Determina si una excursión puede salir en un día de la semana dado, a partir de su texto "salidas".
  // Si no hay fecha de inicio (no sabemos el día de semana real), se asume que puede salir cualquier día.
  function excursionDisponibleEnDia(ex, nombreDia) {
    if (!nombreDia) return true;
    var s = normalizar(ex.salidas);

    if (s.indexOf("todos los dias") !== -1) return true;
    if (s.indexOf("a consultar") !== -1) return true;
    if (s.indexOf("segun disponibilidad") !== -1) return true;

    if (s.indexOf("lunes a sabado") !== -1) {
      return nombreDia !== "domingo";
    }

    // Lista de días sueltos: "Jueves y domingo", "Miércoles y sábado", "Viernes"
    var DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    var encontrados = DIAS.filter(function (d) { return s.indexOf(d) !== -1; });
    if (encontrados.length > 0) {
      return encontrados.indexOf(nombreDia) !== -1;
    }

    // Texto no reconocido: por defecto se asume disponible (mejor mostrar de más que de menos)
    return true;
  }

  // Precio aplicable de una excursión en un día de semana dado (toma promo si corresponde)
  function precioEnDia(ex, nombreDia) {
    var precios = ex.precios;
    if (precios.promo && nombreDia) {
      var diasPromo = precios.promo.dias.map(normalizar);
      if (diasPromo.indexOf(nombreDia) !== -1) {
        return precios.promo.precio;
      }
    }
    return precios.efectivo_transferencia;
  }

  // Algoritmo: prioridad 1 → 2 → 3. Dentro de cada nivel, branch & bound para
  // maximizar el uso del presupuesto. Solo pasa al nivel siguiente si hay días
  // o presupuesto sin cubrir tras agotar las opciones del nivel anterior.
  function armarPropuesta(excursiones, dias, presupuestoPorPersona, fechaInicio) {
    // Construye candidatas por día filtrando por nivel de prioridad
    function candidatasPorDiaParaNivel(nivel) {
      var pool = [];
      for (var d = 0; d < dias; d++) {
        var nombreDia = nombreDiaSemana(fechaInicio, d);
        var cands = excursiones
          .filter(function (ex) { return ex.prioridad === nivel && excursionDisponibleEnDia(ex, nombreDia); })
          .map(function (ex) { return { ex: ex, precio: precioEnDia(ex, nombreDia) }; })
          .filter(function (c) { return c.precio <= presupuestoPorPersona; })
          .sort(function (a, b) { return b.precio - a.precio; });
        pool.push({ nombreDia: nombreDia, candidatas: cands });
      }
      return pool;
    }

    // Branch & bound sobre los días, respetando días ya asignados y excursiones ya usadas.
    // asignacionFija: array de largo `dias`, null = libre, objeto = ya asignado.
    // presupuestoRestante: cuánto queda por gastar por persona.
    // excluidos: set de ids ya usados en asignaciones fijas o niveles anteriores.
    function resolver(candidatasPorDia, asignacionFija, presupuestoRestante, excluidos) {
      var maxRestante = new Array(dias + 1).fill(0);
      for (var i = dias - 1; i >= 0; i--) {
        if (asignacionFija[i] !== null) { maxRestante[i] = maxRestante[i + 1]; continue; }
        var disponibles = candidatasPorDia[i].candidatas.filter(function (c) { return !excluidos[c.ex.id]; });
        var maxDia = disponibles.length ? disponibles[0].precio : 0;
        maxRestante[i] = maxRestante[i + 1] + maxDia;
      }

      var mejor = { total: -1, asignacion: asignacionFija.slice() };
      var usados = Object.assign({}, excluidos);
      var actual = asignacionFija.slice();
      var llamadas = 0;
      var LIMITE = 400000;

      function backtrack(d, totalActual) {
        llamadas++;
        if (llamadas > LIMITE) return;
        if (totalActual > mejor.total) {
          mejor.total = totalActual;
          mejor.asignacion = actual.slice();
        }
        if (d === dias) return;
        if (totalActual + maxRestante[d] <= mejor.total) return;

        // Día ya fijado: saltar
        if (actual[d] !== null) { backtrack(d + 1, totalActual); return; }

        var disponibles = candidatasPorDia[d].candidatas.filter(function (c) { return !usados[c.ex.id]; });
        for (var i = 0; i < disponibles.length; i++) {
          var cand = disponibles[i];
          if (totalActual + cand.precio > presupuestoRestante) continue;
          usados[cand.ex.id] = true;
          actual[d] = cand;
          backtrack(d + 1, totalActual + cand.precio);
          actual[d] = null;
          usados[cand.ex.id] = false;
        }
        backtrack(d + 1, totalActual); // día libre
      }

      backtrack(0, 0);
      return mejor;
    }

    // Construimos candidatas globales para el render (todos los niveles, para conocer el día/nombre)
    var todasCandidatasPorDia = [];
    for (var d = 0; d < dias; d++) {
      var nombreDia = nombreDiaSemana(fechaInicio, d);
      todasCandidatasPorDia.push({ nombreDia: nombreDia, candidatas: [] });
    }

    // Fase 1: prioridad 1
    var asignacion = new Array(dias).fill(null);
    var excluidos = {};
    var gastado = 0;

    for (var nivel = 1; nivel <= 3; nivel++) {
      var candsPorDia = candidatasPorDiaParaNivel(nivel);
      var resultado = resolver(candsPorDia, asignacion, presupuestoPorPersona - gastado, excluidos);
      // Incorporar lo nuevo al estado acumulado
      for (var d2 = 0; d2 < dias; d2++) {
        if (asignacion[d2] === null && resultado.asignacion[d2] !== null) {
          var asig = resultado.asignacion[d2];
          asignacion[d2] = asig;
          gastado += asig.precio;
          excluidos[asig.ex.id] = true;
        }
      }
      // Si todos los días están cubiertos o no queda presupuesto, parar
      var diasLibres = asignacion.filter(function (a) { return a === null; }).length;
      if (diasLibres === 0 || gastado >= presupuestoPorPersona) break;
    }

    return {
      asignacion: asignacion,
      totalPorPersona: gastado,
      candidatasPorDia: todasCandidatasPorDia
    };
  }

  function renderResultadoArmador() {
    if (!propuestaActual) return;
    var asignacion = propuestaActual.asignacion;
    var dias = propuestaActual.dias;
    var presupuesto = propuestaActual.presupuesto;
    var presupuestoPorPersona = propuestaActual.presupuestoPorPersona;
    var personas = propuestaActual.personas;
    var fechaInicio = propuestaActual.fechaInicio;

    var totalPorPersona = asignacion.reduce(function (sum, a) { return sum + (a ? a.precio : 0); }, 0);
    var totalGrupo = totalPorPersona * personas;
    var sobrante = presupuesto - totalGrupo;
    var excursionesAsignadas = asignacion.filter(function (a) { return a !== null; }).length;

    // IDs ya usados en la propuesta actual
    function idsUsados(excluirDia) {
      var usados = {};
      asignacion.forEach(function (a, i) {
        if (a && i !== excluirDia) usados[a.ex.id] = true;
      });
      return usados;
    }

    var html = '';

    html += '<div class="propuesta-resumen">' +
      '<div class="stat"><span class="num">' + excursionesAsignadas + ' / ' + dias + '</span><span class="lbl">Excursiones asignadas</span></div>' +
      '<div class="stat"><span class="num">' + formatoMoneda(totalPorPersona) + '</span><span class="lbl">Por persona (precio público)</span></div>' +
      '<div class="stat"><span class="num">' + formatoMoneda(totalGrupo) + '</span><span class="lbl">Total del grupo</span></div>' +
      '<div class="stat"><span class="num">' + formatoMoneda(sobrante) + '</span><span class="lbl">Presupuesto sin usar</span></div>' +
      '</div>';

    if (excursionesAsignadas === 0) {
      html += '<div class="armador-mensaje">No se encontró ninguna excursión que entre dentro del presupuesto por persona (' + formatoMoneda(presupuestoPorPersona) + '). Probá aumentar el presupuesto.</div>';
    }

    for (var d = 0; d < dias; d++) {
      var asignada = asignacion[d];
      var nombreDia = nombreDiaSemana(fechaInicio, d);
      var etiquetaDia = 'Día ' + (d + 1) + (nombreDia ? ' (' + capitalizar(nombreDia) + ')' : '');

      if (asignada) {
        // Calcular presupuesto disponible para este slot: lo que no se gastó en los otros días
        var budgetSlot = presupuestoPorPersona - (totalPorPersona - asignada.precio);
        var usados = idsUsados(d);

        // Opciones de reemplazo: disponibles ese día, dentro del budget, no ya usadas
        var opciones = data.excursiones
          .filter(function (ex) {
            return ex.id !== asignada.ex.id && !usados[ex.id] && excursionDisponibleEnDia(ex, nombreDia);
          })
          .map(function (ex) { return { ex: ex, precio: precioEnDia(ex, nombreDia) }; })
          .filter(function (c) { return c.precio <= budgetSlot; })
          .sort(function (a, b) { return a.ex.prioridad - b.ex.prioridad || b.precio - a.precio; });

        var opcionesHtml = '';
        if (opciones.length === 0) {
          opcionesHtml = '<p class="reemplazo-vacio">No hay otras excursiones disponibles para este día dentro del presupuesto.</p>';
        } else {
          opciones.forEach(function (op) {
            opcionesHtml += '<button class="reemplazo-opcion" data-dia="' + d + '" data-exid="' + op.ex.id + '" data-precio="' + op.precio + '">' +
              '<span class="reemplazo-opcion__nombre">' + escapeHtml(op.ex.nombre) + '</span>' +
              '<span class="reemplazo-opcion__detalle">' + escapeHtml(op.ex.horario) + ' · P' + op.ex.prioridad + '</span>' +
              '<span class="reemplazo-opcion__precio">' + formatoMoneda(op.precio) + '</span>' +
              '</button>';
          });
        }

        html += '<div class="propuesta-dia-wrap">' +
          '<div class="propuesta-dia">' +
            '<div class="propuesta-dia__dia">' + etiquetaDia + '</div>' +
            '<div class="propuesta-dia__excursion"><span class="nombre">' + escapeHtml(asignada.ex.nombre) + '</span><br><span class="detalle">' + escapeHtml(asignada.ex.horario) + '</span></div>' +
            '<div class="propuesta-dia__precio">' + formatoMoneda(asignada.precio) + ' / persona</div>' +
            '<button class="reemplazo-toggle" data-dia="' + d + '" title="Ver opciones de reemplazo">&#8645; Cambiar</button>' +
          '</div>' +
          '<div class="reemplazo-panel" id="reemplazo-panel-' + d + '" hidden>' +
            '<p class="reemplazo-panel__titulo">Reemplazar por:</p>' +
            opcionesHtml +
          '</div>' +
        '</div>';
      } else {
        // Día libre: ofrecer agregar excursión
        var usadosLibre = idsUsados(d);
        var opcionesLibre = data.excursiones
          .filter(function (ex) { return !usadosLibre[ex.id] && excursionDisponibleEnDia(ex, nombreDia); })
          .map(function (ex) { return { ex: ex, precio: precioEnDia(ex, nombreDia) }; })
          .filter(function (c) { return c.precio <= (presupuestoPorPersona - totalPorPersona); })
          .sort(function (a, b) { return a.ex.prioridad - b.ex.prioridad || b.precio - a.precio; });

        var opcionesLibreHtml = '';
        if (opcionesLibre.length === 0) {
          opcionesLibreHtml = '<p class="reemplazo-vacio">No hay excursiones disponibles para agregar en este día dentro del presupuesto restante.</p>';
        } else {
          opcionesLibre.forEach(function (op) {
            opcionesLibreHtml += '<button class="reemplazo-opcion" data-dia="' + d + '" data-exid="' + op.ex.id + '" data-precio="' + op.precio + '">' +
              '<span class="reemplazo-opcion__nombre">' + escapeHtml(op.ex.nombre) + '</span>' +
              '<span class="reemplazo-opcion__detalle">' + escapeHtml(op.ex.horario) + ' · P' + op.ex.prioridad + '</span>' +
              '<span class="reemplazo-opcion__precio">' + formatoMoneda(op.precio) + '</span>' +
              '</button>';
          });
        }

        html += '<div class="propuesta-dia-wrap">' +
          '<div class="propuesta-dia libre">' +
            '<div class="propuesta-dia__dia">' + etiquetaDia + '</div>' +
            '<div class="propuesta-dia__excursion">Día libre</div>' +
            '<div class="propuesta-dia__precio">—</div>' +
            '<button class="reemplazo-toggle" data-dia="' + d + '" title="Agregar excursión">+ Agregar</button>' +
          '</div>' +
          '<div class="reemplazo-panel" id="reemplazo-panel-' + d + '" hidden>' +
            '<p class="reemplazo-panel__titulo">Agregar excursión:</p>' +
            opcionesLibreHtml +
          '</div>' +
        '</div>';
      }
    }

    document.getElementById("armador-resultado").innerHTML = html;
  }

})();
