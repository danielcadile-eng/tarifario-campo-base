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
      renderResultadoArmador(resultado, dias, presupuesto, presupuestoPorPersona, personas, fechaInicio);
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

  // Algoritmo: branch & bound para maximizar el aprovechamiento del presupuesto,
  // asignando como máximo una excursión por día, sin repetir excursiones,
  // respetando los días de salida de cada excursión.
  function armarPropuesta(excursiones, dias, presupuestoPorPersona, fechaInicio) {
    // Para cada día, lista de candidatas (excursion, precio) ordenadas por precio descendente
    var candidatasPorDia = [];
    for (var d = 0; d < dias; d++) {
      var nombreDia = nombreDiaSemana(fechaInicio, d);
      var candidatas = excursiones
        .filter(function (ex) { return excursionDisponibleEnDia(ex, nombreDia); })
        .map(function (ex) { return { ex: ex, precio: precioEnDia(ex, nombreDia) }; })
        .filter(function (c) { return c.precio <= presupuestoPorPersona; })
        .sort(function (a, b) { return b.precio - a.precio; });
      candidatasPorDia.push({ nombreDia: nombreDia, candidatas: candidatas });
    }

    // Máximo precio posible restante desde el día d en adelante (para poda)
    var maxRestante = new Array(dias + 1).fill(0);
    for (var i = dias - 1; i >= 0; i--) {
      var maxDia = candidatasPorDia[i].candidatas.length ? candidatasPorDia[i].candidatas[0].precio : 0;
      maxRestante[i] = maxRestante[i + 1] + maxDia;
    }

    var mejor = { total: -1, asignacion: new Array(dias).fill(null) };
    var usados = {};
    var actual = new Array(dias).fill(null);
    var llamadas = 0;
    var LIMITE_LLAMADAS = 400000;

    function backtrack(d, totalActual) {
      llamadas++;
      if (llamadas > LIMITE_LLAMADAS) return; // salvaguarda de rendimiento

      if (totalActual > mejor.total) {
        mejor.total = totalActual;
        mejor.asignacion = actual.slice();
      }

      if (d === dias) return;
      if (totalActual + maxRestante[d] <= mejor.total) return; // poda: no puede superar lo mejor encontrado

      var candidatas = candidatasPorDia[d].candidatas;
      for (var i = 0; i < candidatas.length; i++) {
        var cand = candidatas[i];
        if (usados[cand.ex.id]) continue;
        if (totalActual + cand.precio > presupuestoPorPersona) continue;

        usados[cand.ex.id] = true;
        actual[d] = cand;
        backtrack(d + 1, totalActual + cand.precio);
        actual[d] = null;
        usados[cand.ex.id] = false;
      }

      // Opción: dejar el día libre
      backtrack(d + 1, totalActual);
    }

    backtrack(0, 0);

    return {
      asignacion: mejor.asignacion,
      totalPorPersona: mejor.total < 0 ? 0 : mejor.total,
      candidatasPorDia: candidatasPorDia
    };
  }

  function renderResultadoArmador(resultado, dias, presupuesto, presupuestoPorPersona, personas, fechaInicio) {
    var el = document.getElementById("armador-resultado");
    var asignacion = resultado.asignacion;
    var totalPorPersona = resultado.totalPorPersona;
    var totalGrupo = totalPorPersona * personas;
    var sobrante = presupuesto - totalGrupo;
    var excursionesAsignadas = asignacion.filter(function (a) { return a !== null; }).length;

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
      var nombreDia = resultado.candidatasPorDia[d].nombreDia;
      var etiquetaDia = 'Día ' + (d + 1) + (nombreDia ? ' (' + capitalizar(nombreDia) + ')' : '');

      if (asignada) {
        html += '<div class="propuesta-dia">' +
          '<div class="propuesta-dia__dia">' + etiquetaDia + '</div>' +
          '<div class="propuesta-dia__excursion"><span class="nombre">' + escapeHtml(asignada.ex.nombre) + '</span><br><span class="detalle">' + escapeHtml(asignada.ex.horario) + '</span></div>' +
          '<div class="propuesta-dia__precio">' + formatoMoneda(asignada.precio) + ' / persona</div>' +
          '</div>';
      } else {
        html += '<div class="propuesta-dia libre">' +
          '<div class="propuesta-dia__dia">' + etiquetaDia + '</div>' +
          '<div class="propuesta-dia__excursion">Día libre</div>' +
          '<div class="propuesta-dia__precio">—</div>' +
          '</div>';
      }
    }

    el.innerHTML = html;
  }

})();
